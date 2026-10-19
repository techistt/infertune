//! A small local server that forwards OpenAI-style requests (`/v1/...`) to
//! the provider selected in InferTune. It listens on 127.0.0.1 only, so other
//! tools on this computer can use one stable address and an optional token.

use crate::providers::ProviderConfig;
use axum::{
    body::{to_bytes, Body},
    extract::{Request, State},
    http::{header, HeaderMap, HeaderValue, Method, StatusCode},
    response::{IntoResponse, Response},
    routing::any,
    Router,
};
use serde::Serialize;
use std::net::SocketAddr;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::sync::oneshot;

/// Largest request body that is forwarded.
const MAX_BODY: usize = 32 * 1024 * 1024;

struct Shared {
    provider: ProviderConfig,
    token: Option<String>,
    requests: AtomicU64,
    client: reqwest::Client,
}

/// A running server; dropping or stopping it shuts the listener down.
pub struct ApiServer {
    pub port: u16,
    shared: Arc<Shared>,
    shutdown: Option<oneshot::Sender<()>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ApiStatus {
    pub running: bool,
    pub port: u16,
    pub requests: u64,
}

impl ApiServer {
    pub fn status(&self) -> ApiStatus {
        ApiStatus {
            running: true,
            port: self.port,
            requests: self.shared.requests.load(Ordering::Relaxed),
        }
    }

    pub fn stop(&mut self) {
        if let Some(tx) = self.shutdown.take() {
            let _ = tx.send(());
        }
    }
}

impl Drop for ApiServer {
    fn drop(&mut self) {
        self.stop();
    }
}

/// True when the request carries the expected bearer token (or none is set).
pub fn authorized(headers: &HeaderMap, token: &Option<String>) -> bool {
    let Some(expected) = token.as_deref().filter(|t| !t.is_empty()) else {
        return true;
    };

    headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(|given| given.trim() == expected)
        .unwrap_or(false)
}

/// Upstream URL for a request path like `/v1/chat/completions?x=1`.
pub fn upstream_url(provider: &ProviderConfig, path_and_query: &str) -> String {
    format!("{}{}", provider.root(), path_and_query)
}

fn error(status: StatusCode, message: &str) -> Response {
    let body = serde_json::json!({ "error": { "message": message } });

    (status, axum::Json(body)).into_response()
}

async fn handle(State(shared): State<Arc<Shared>>, req: Request) -> Response {
    let path = req
        .uri()
        .path_and_query()
        .map(|p| p.as_str().to_string())
        .unwrap_or_else(|| req.uri().path().to_string());

    if req.method() == Method::GET && req.uri().path() == "/health" {
        return (StatusCode::OK, "ok").into_response();
    }

    if !authorized(req.headers(), &shared.token) {
        return error(StatusCode::UNAUTHORIZED, "Missing or wrong API token");
    }

    if !req.uri().path().starts_with("/v1/") {
        return error(StatusCode::NOT_FOUND, "Only /v1/... endpoints are available");
    }

    shared.requests.fetch_add(1, Ordering::Relaxed);

    let method = req.method().clone();
    let content_type = req.headers().get(header::CONTENT_TYPE).cloned();

    let body = match to_bytes(req.into_body(), MAX_BODY).await {
        Ok(b) => b,
        Err(_) => return error(StatusCode::PAYLOAD_TOO_LARGE, "Request body too large"),
    };

    let url = upstream_url(&shared.provider, &path);

    let mut upstream = shared.client.request(method, &url).body(body);

    if let Some(ct) = content_type {
        upstream = upstream.header(header::CONTENT_TYPE, ct);
    }

    let key = shared.provider.api_key.trim();
    if !key.is_empty() {
        upstream = upstream.bearer_auth(key);
    }

    let response = match upstream.send().await {
        Ok(r) => r,
        Err(e) => {
            return error(
                StatusCode::BAD_GATEWAY,
                &format!("Could not reach {}: {}", shared.provider.root(), e),
            )
        }
    };

    let status = StatusCode::from_u16(response.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
    let mut out = Response::builder().status(status);

    if let Some(ct) = response.headers().get(header::CONTENT_TYPE) {
        if let Ok(v) = HeaderValue::from_bytes(ct.as_bytes()) {
            out = out.header(header::CONTENT_TYPE, v);
        }
    }

    // Stream the body through so server-sent events arrive as they are made.
    out.body(Body::from_stream(response.bytes_stream()))
        .unwrap_or_else(|_| error(StatusCode::INTERNAL_SERVER_ERROR, "Bad upstream response"))
}

/// Starts listening on 127.0.0.1:`port`. Port 0 picks a free port.
pub async fn start(
    provider: ProviderConfig,
    port: u16,
    token: Option<String>,
) -> Result<ApiServer, String> {
    let shared = Arc::new(Shared {
        provider,
        token: token.filter(|t| !t.trim().is_empty()),
        requests: AtomicU64::new(0),
        client: reqwest::Client::builder()
            .connect_timeout(std::time::Duration::from_secs(10))
            .build()
            .map_err(|e| e.to_string())?,
    });

    let app = Router::new()
        .route("/{*rest}", any(handle))
        .route("/", any(handle))
        .with_state(shared.clone());

    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|e| format!("Could not listen on port {}: {}", port, e))?;
    let bound = listener.local_addr().map_err(|e| e.to_string())?.port();

    let (tx, rx) = oneshot::channel::<()>();

    tauri::async_runtime::spawn(async move {
        let _ = axum::serve(listener, app)
            .with_graceful_shutdown(async {
                let _ = rx.await;
            })
            .await;
    });

    Ok(ApiServer {
        port: bound,
        shared,
        shutdown: Some(tx),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn headers(value: Option<&str>) -> HeaderMap {
        let mut h = HeaderMap::new();
        if let Some(v) = value {
            h.insert(header::AUTHORIZATION, HeaderValue::from_str(v).unwrap());
        }
        h
    }

    #[test]
    fn no_token_means_open() {
        assert!(authorized(&headers(None), &None));
        assert!(authorized(&headers(None), &Some(String::new())));
    }

    #[test]
    fn token_must_match() {
        let t = Some("abc".to_string());
        assert!(authorized(&headers(Some("Bearer abc")), &t));
        assert!(!authorized(&headers(Some("Bearer nope")), &t));
        assert!(!authorized(&headers(Some("abc")), &t));
        assert!(!authorized(&headers(None), &t));
    }

    #[test]
    fn upstream_url_joins_root_and_path() {
        let p = ProviderConfig {
            kind: "openai".into(),
            base_url: "http://localhost:1234/v1/".into(),
            api_key: String::new(),
        };
        assert_eq!(
            upstream_url(&p, "/v1/chat/completions?x=1"),
            "http://localhost:1234/v1/chat/completions?x=1"
        );
    }
}
