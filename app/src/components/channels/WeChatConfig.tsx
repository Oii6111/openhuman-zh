import debug from 'debug';
import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useT } from '../../lib/i18n/I18nContext';
import { channelConnectionsApi } from '../../services/api/channelConnectionsApi';
import {
  disconnectChannelConnection,
  setChannelConnectionStatus,
  upsertChannelConnection,
} from '../../store/channelConnectionsSlice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import type { ChannelDefinition } from '../../types/channels';
import { restartCoreProcess } from '../../utils/tauriCommands/core';
import Button from '../ui/Button';
import { ChannelConfigError } from './channelConfigPrimitives';

const log = debug('channels:wechat');

interface WeChatConfigProps {
  definition: ChannelDefinition;
}

type WeChatLoginPhase = 'idle' | 'qr' | 'verify' | 'done';

const WeChatConfig = (_props: WeChatConfigProps) => {
  const { t } = useT();
  const dispatch = useAppDispatch();
  const connection = useAppSelector(state => state.channelConnections.connections.wechat?.api_key);
  const status = connection?.status ?? 'disconnected';

  const [phase, setPhase] = useState<WeChatLoginPhase>('idle');
  const [qrcodeUrl, setQrcodeUrl] = useState('');
  const [sessionKey, setSessionKey] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const finishConfirmed = useCallback(async () => {
    cancelledRef.current = true;
    setPhase('done');
    dispatch(
      setChannelConnectionStatus({ channel: 'wechat', authMode: 'api_key', status: 'connecting' })
    );

    try {
      log('wechat login confirmed — restarting core to activate iLink listener');
      await restartCoreProcess();
      dispatch(
        upsertChannelConnection({
          channel: 'wechat',
          authMode: 'api_key',
          patch: { status: 'connected', lastError: undefined, capabilities: ['read', 'write'] },
        })
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log('wechat core restart failed: %s', msg);
      setError(
        t('channels.wechat.restartRequired', '登录成功，但重启核心失败，请手动重启后再使用')
      );
      dispatch(
        upsertChannelConnection({
          channel: 'wechat',
          authMode: 'api_key',
          patch: { status: 'error', lastError: msg },
        })
      );
    }
  }, [dispatch, t]);

  const runPoll = useCallback(
    async (key: string) => {
      try {
        while (!cancelledRef.current) {
          const check = await channelConnectionsApi.wechatLoginCheck(key);
          if (cancelledRef.current) return;

          if (check.qrcodeUrl) {
            setQrcodeUrl(check.qrcodeUrl);
          }

          switch (check.status) {
            case 'confirmed':
              await finishConfirmed();
              return;
            case 'need_verifycode':
              setPhase('verify');
              return;
            case 'expired':
            case 'verify_code_blocked':
            case 'binded_redirect':
            case 'failed':
              setPhase('idle');
              setError(check.message || t('channels.wechat.loginFailed', '微信登录失败，请重试'));
              dispatch(
                upsertChannelConnection({
                  channel: 'wechat',
                  authMode: 'api_key',
                  patch: { status: 'error', lastError: check.message ?? undefined },
                })
              );
              return;
            case 'wait':
            case 'scanned':
            default:
              // Backend calls are long-polls, but guard against tight loops
              // (e.g. mocked/immediate responses) with a short idle delay.
              await new Promise<void>(resolve => window.setTimeout(resolve, 2_000));
              break;
          }
        }
      } catch (e) {
        if (cancelledRef.current) return;
        const msg = e instanceof Error ? e.message : String(e);
        log('wechat login poll failed: %s', msg);
        setError(msg);
        setPhase('idle');
        dispatch(
          upsertChannelConnection({
            channel: 'wechat',
            authMode: 'api_key',
            patch: { status: 'error', lastError: msg },
          })
        );
      }
    },
    [dispatch, finishConfirmed, t]
  );

  const handleStart = useCallback(async () => {
    setBusy(true);
    setError(null);
    cancelledRef.current = false;
    try {
      const start = await channelConnectionsApi.wechatLoginStart();
      log('wechat login start', { sessionKey: start.sessionKey });
      setSessionKey(start.sessionKey);
      setQrcodeUrl(start.qrcodeUrl);
      setPhase('qr');
      dispatch(
        setChannelConnectionStatus({ channel: 'wechat', authMode: 'api_key', status: 'connecting' })
      );
      void runPoll(start.sessionKey);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log('wechat login start failed: %s', msg);
      setError(msg);
      setPhase('idle');
    } finally {
      setBusy(false);
    }
  }, [dispatch, runPoll]);

  const handleVerify = useCallback(async () => {
    const code = verifyCode.trim();
    if (!sessionKey || !code) {
      setError(t('channels.wechat.verifyCodeRequired', '请输入手机微信上显示的验证码'));
      return;
    }
    setBusy(true);
    setError(null);
    cancelledRef.current = false;
    try {
      const check = await channelConnectionsApi.wechatLoginCheck(sessionKey, code);
      if (check.qrcodeUrl) {
        setQrcodeUrl(check.qrcodeUrl);
      }
      if (check.status === 'confirmed') {
        await finishConfirmed();
      } else if (check.status === 'need_verifycode') {
        setError(check.message ?? t('channels.wechat.verifyCodeInvalid', '验证码不正确，请重试'));
      } else if (check.status === 'wait' || check.status === 'scanned') {
        setPhase('qr');
        void runPoll(sessionKey);
      } else {
        setPhase('idle');
        setError(check.message || t('channels.wechat.loginFailed', '微信登录失败，请重试'));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }, [finishConfirmed, runPoll, sessionKey, t, verifyCode]);

  const handleCancel = useCallback(() => {
    cancelledRef.current = true;
    setPhase('idle');
    setQrcodeUrl('');
    setSessionKey('');
    setVerifyCode('');
    setError(null);
    dispatch(
      upsertChannelConnection({
        channel: 'wechat',
        authMode: 'api_key',
        patch: { status: 'disconnected', lastError: undefined },
      })
    );
  }, [dispatch]);

  const handleDisconnect = useCallback(async () => {
    setBusy(true);
    setError(null);
    cancelledRef.current = true;
    try {
      await channelConnectionsApi.disconnectChannel('wechat', 'api_key');
      dispatch(disconnectChannelConnection({ channel: 'wechat', authMode: 'api_key' }));
      setPhase('idle');
      setQrcodeUrl('');
      setSessionKey('');
      setVerifyCode('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }, [dispatch]);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-primary-200 dark:border-primary-500/30 bg-primary-50/80 dark:bg-primary-500/10 px-4 py-3 text-sm text-content-secondary">
        <p className="font-medium text-content">
          {t('channels.wechat.loginTitle', '扫码登录微信')}
        </p>
        <p className="mt-1 text-xs text-content-secondary">
          {t(
            'channels.wechat.loginBody',
            '使用手机微信扫描二维码，确认后会自动保存 bot_token 并连接 iLink 通道。'
          )}
        </p>
      </div>

      {error && <ChannelConfigError message={error} />}

      {status === 'connected' || phase === 'done' ? (
        <div className="rounded-lg border border-line bg-surface-muted p-4 text-sm">
          <p className="font-medium text-content">{t('channels.wechat.connected', '微信已连接')}</p>
          <p className="mt-1 text-xs text-content-muted">
            {t(
              'channels.wechat.connectedHint',
              '个人微信消息会通过 iLink 通道收发。如需更换账号，请先断开再重新扫码。'
            )}
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            disabled={busy}
            onClick={handleDisconnect}>
            {t('accounts.disconnect')}
          </Button>
        </div>
      ) : phase === 'qr' || phase === 'verify' ? (
        <div className="rounded-lg border border-line bg-surface-muted p-4">
          {qrcodeUrl ? (
            <div
              role="img"
              aria-label={t('channels.wechat.qrAlt', '微信登录二维码')}
              className="mx-auto w-fit rounded-lg bg-white p-2">
              <QRCodeSVG value={qrcodeUrl} size={224} />
            </div>
          ) : (
            <p className="text-sm text-content-muted">
              {t('channels.wechat.qrMissing', '二维码生成中…')}
            </p>
          )}

          {phase === 'verify' && (
            <div className="mt-4 space-y-2">
              <label className="block text-xs font-medium text-content">
                {t('channels.wechat.verifyCodeLabel', '手机微信上显示的验证码')}
              </label>
              <input
                type="text"
                value={verifyCode}
                onChange={e => setVerifyCode(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-content outline-none focus:border-primary-400"
                placeholder={t('channels.wechat.verifyCodePlaceholder', '例如 123456')}
                disabled={busy}
              />
              <Button variant="primary" size="sm" disabled={busy} onClick={handleVerify}>
                {t('channels.wechat.submitVerifyCode', '提交验证码')}
              </Button>
            </div>
          )}

          <div className="mt-4 flex items-center gap-2">
            <Button variant="secondary" size="sm" disabled={busy} onClick={handleCancel}>
              {t('common.cancel', '取消')}
            </Button>
            <span className="text-xs text-content-muted">
              {phase === 'verify'
                ? t('channels.wechat.waitingVerify', '等待验证码确认…')
                : t('channels.wechat.waitingScan', '等待手机微信扫码…')}
            </span>
          </div>
        </div>
      ) : (
        <Button variant="primary" size="sm" disabled={busy} onClick={handleStart}>
          {t('channels.wechat.startLogin', '扫码登录微信')}
        </Button>
      )}
    </div>
  );
};

export default WeChatConfig;
