import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { channelConnectionsApi } from '../../../services/api/channelConnectionsApi';
import { createTestStore, renderWithProviders } from '../../../test/test-utils';
import type { ChannelDefinition } from '../../../types/channels';
import { restartCoreProcess } from '../../../utils/tauriCommands/core';
import WeChatConfig from '../WeChatConfig';

const wechatDef: ChannelDefinition = {
  id: 'wechat',
  display_name: 'WeChat (个人微信)',
  description: 'iLink 个人微信通道',
  icon: 'wechat',
  auth_modes: [{ mode: 'api_key', description: 'iLink bot token', fields: [] }],
  capabilities: ['send_text', 'receive_text', 'typing'],
};

vi.mock('../../../services/api/channelConnectionsApi', () => ({
  channelConnectionsApi: {
    wechatLoginStart: vi.fn(),
    wechatLoginCheck: vi.fn(),
    disconnectChannel: vi.fn(),
  },
}));

vi.mock('../../../utils/tauriCommands/core', () => ({ restartCoreProcess: vi.fn() }));

afterEach(() => {
  vi.clearAllMocks();
});

describe('WeChatConfig', () => {
  it('shows the QR login button when disconnected', () => {
    renderWithProviders(<WeChatConfig definition={wechatDef} />);
    expect(screen.getByRole('button', { name: 'Scan to log in to WeChat' })).toBeInTheDocument();
  });

  it('starts login and renders the QR code image', async () => {
    vi.mocked(channelConnectionsApi.wechatLoginStart).mockResolvedValue({
      sessionKey: 'session-1',
      qrcodeUrl: 'data:image/png;base64,abc123',
      qrcode: 'qrcode-1',
    });
    vi.mocked(channelConnectionsApi.wechatLoginCheck).mockResolvedValue({
      status: 'wait',
      message: '等待扫码',
    });

    renderWithProviders(<WeChatConfig definition={wechatDef} />);

    fireEvent.click(screen.getByRole('button', { name: 'Scan to log in to WeChat' }));

    await waitFor(() => {
      expect(channelConnectionsApi.wechatLoginStart).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('img', { name: 'WeChat login QR code' })).toBeInTheDocument();
      expect(document.querySelector('svg')).toBeInTheDocument();
    });
  });

  it('shows the verify-code input when iLink asks for a code', async () => {
    vi.mocked(channelConnectionsApi.wechatLoginStart).mockResolvedValue({
      sessionKey: 'session-2',
      qrcodeUrl: 'data:image/png;base64,abc123',
      qrcode: 'qrcode-2',
    });
    vi.mocked(channelConnectionsApi.wechatLoginCheck).mockResolvedValue({
      status: 'need_verifycode',
      message: '输入验证码',
    });

    renderWithProviders(<WeChatConfig definition={wechatDef} />);

    fireEvent.click(screen.getByRole('button', { name: 'Scan to log in to WeChat' }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('e.g. 123456')).toBeInTheDocument();
    });
  });

  it('submits the verify code and marks the channel connected after restart', async () => {
    const store = createTestStore();
    vi.mocked(channelConnectionsApi.wechatLoginStart).mockResolvedValue({
      sessionKey: 'session-3',
      qrcodeUrl: 'data:image/png;base64,abc123',
      qrcode: 'qrcode-3',
    });
    vi.mocked(channelConnectionsApi.wechatLoginCheck)
      .mockResolvedValueOnce({ status: 'need_verifycode', message: '输入验证码' })
      .mockResolvedValueOnce({
        status: 'confirmed',
        botToken: 'bot-token-3',
        accountId: 'bot-id-3',
        baseUrl: 'https://ilinkai.weixin.qq.com',
        userId: 'user-3',
        message: '已连接',
      });
    vi.mocked(restartCoreProcess).mockResolvedValue(undefined);

    renderWithProviders(<WeChatConfig definition={wechatDef} />, { store });

    fireEvent.click(screen.getByRole('button', { name: 'Scan to log in to WeChat' }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('e.g. 123456')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('e.g. 123456'), { target: { value: '123456' } });
    fireEvent.click(screen.getByText('Submit verification code'));

    await waitFor(() => {
      expect(channelConnectionsApi.wechatLoginCheck).toHaveBeenCalledWith('session-3', '123456');
      expect(restartCoreProcess).toHaveBeenCalledTimes(1);
    });
  });
});
