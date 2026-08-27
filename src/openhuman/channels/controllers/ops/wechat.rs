//! Managed iLink QR-code login flow for the WeChat channel.

use std::sync::OnceLock;
use std::time::Duration;

use tinychannels::controllers::{WeChatLoginCheckResult, WeChatLoginStartResult};
use tinychannels::providers::wechat::login::WeChatLoginManager;

use crate::openhuman::config::{Config, WeChatConfig};
use crate::rpc::RpcOutcome;

const DEFAULT_WECHAT_BASE_URL: &str = "https://ilinkai.weixin.qq.com";
const DEFAULT_WECHAT_CDN_BASE_URL: &str = "https://novac2c.cdn.weixin.qq.com/c2c";
const WECHAT_LOGIN_POLL_TIMEOUT: Duration = Duration::from_secs(20);

fn wechat_login_manager() -> &'static WeChatLoginManager {
    static MANAGER: OnceLock<WeChatLoginManager> = OnceLock::new();
    MANAGER.get_or_init(|| {
        WeChatLoginManager::with_client(crate::openhuman::config::build_runtime_proxy_client(
            "channel.wechat",
        ))
    })
}

/// Step 1: Start an iLink QR login and return the QR image/data URL.
pub async fn wechat_login_start(
    config: &Config,
) -> Result<RpcOutcome<WeChatLoginStartResult>, String> {
    let session_key = uuid::Uuid::new_v4().to_string();
    let base_url = config
        .channels_config
        .wechat
        .as_ref()
        .map(|c| c.base_url.clone())
        .unwrap_or_else(|| DEFAULT_WECHAT_BASE_URL.to_string());
    let local_tokens = config
        .channels_config
        .wechat
        .as_ref()
        .map(|c| vec![c.bot_token.clone()])
        .unwrap_or_default();

    let qr = wechat_login_manager()
        .start(&session_key, &base_url, None, &local_tokens, false)
        .await
        .map_err(|e| format!("failed to start WeChat login: {e}"))?;

    Ok(RpcOutcome::new(
        WeChatLoginStartResult {
            session_key,
            qrcode_url: qr.qrcode_url,
            qrcode: qr.qrcode,
        },
        vec![],
    ))
}

/// Step 2: Long-poll the QR status. Pass `verify_code` when the previous poll
/// returned `need_verifycode`.
///
/// On `confirmed`, persists `channels_config.wechat` with the returned
/// `bot_token` and `base_url`.
pub async fn wechat_login_check(
    config: &Config,
    session_key: &str,
    verify_code: Option<&str>,
) -> Result<RpcOutcome<WeChatLoginCheckResult>, String> {
    let manager = wechat_login_manager();

    if let Some(code) = verify_code.map(str::trim).filter(|s| !s.is_empty()) {
        manager
            .submit_verify_code(session_key, code)
            .map_err(|e| format!("failed to submit WeChat verify code: {e}"))?;
    }

    let poll = manager
        .poll(session_key, WECHAT_LOGIN_POLL_TIMEOUT)
        .await
        .map_err(|e| format!("failed to poll WeChat login status: {e}"))?;

    let result = WeChatLoginCheckResult {
        status: poll.status.as_str().to_string(),
        qrcode_url: poll.qrcode_url,
        bot_token: poll.bot_token,
        account_id: poll.account_id,
        base_url: poll.base_url,
        user_id: poll.user_id,
        message: poll.message,
    };

    if result.status == "confirmed" {
        if let Some(bot_token) = result.bot_token.clone().filter(|s| !s.is_empty()) {
            let mut persisted = config.clone();
            let existing = persisted.channels_config.wechat.as_ref();
            let base_url = result.base_url.clone().unwrap_or_else(|| {
                existing
                    .map(|c| c.base_url.clone())
                    .unwrap_or_else(|| DEFAULT_WECHAT_BASE_URL.to_string())
            });
            let cdn_base_url = existing
                .map(|c| c.cdn_base_url.clone())
                .unwrap_or_else(|| DEFAULT_WECHAT_CDN_BASE_URL.to_string());
            let allowed_users = existing
                .map(|c| c.allowed_users.clone())
                .unwrap_or_else(|| vec!["*".to_string()]);
            let default_user = result
                .user_id
                .clone()
                .or_else(|| existing.and_then(|c| c.default_user.clone()));

            persisted.channels_config.wechat = Some(WeChatConfig {
                bot_token,
                base_url,
                cdn_base_url,
                allowed_users,
                default_user,
            });

            persisted
                .save()
                .await
                .map_err(|e| format!("failed to persist wechat config.toml: {e}"))?;
        }
    }

    Ok(RpcOutcome::new(result, vec![]))
}
