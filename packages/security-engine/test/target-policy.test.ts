import { assertUrlAllowed, checkAddress, hostPortKey, parsePolicy, parseTargetUrl, TargetPolicyError } from '../src/http/target-policy';

describe('checkAddress', () => {
  it.each(['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111'])('allows public address %s', (ip) => {
    expect(checkAddress(ip, false)).toBeNull();
  });

  it.each(['10.0.0.5', '172.16.3.4', '192.168.1.1', '127.0.0.1', '::1', 'fc00::1', '100.64.0.1', '::ffff:127.0.0.1'])(
    'blocks internal address %s unless allowlisted',
    (ip) => {
      expect(checkAddress(ip, false)).not.toBeNull();
      expect(checkAddress(ip, true)).toBeNull();
    },
  );

  it.each(['169.254.169.254', 'fe80::1', '0.0.0.0', '224.0.0.1', '255.255.255.255', '192.0.2.1'])(
    'always blocks %s, even when allowlisted',
    (ip) => {
      expect(checkAddress(ip, true)).not.toBeNull();
    },
  );
});

describe('parseTargetUrl', () => {
  it.each(['ftp://example.com', 'file:///etc/passwd', 'gopher://x', 'javascript:alert(1)', 'not a url'])('rejects %s', (raw) => {
    expect(() => parseTargetUrl(raw)).toThrow(TargetPolicyError);
  });

  it('rejects credentials in the URL', () => {
    expect(() => parseTargetUrl('https://user:pass@example.com')).toThrow(/credentials/);
  });
});

describe('hostPortKey', () => {
  it('fills in default ports and lowercases the host', () => {
    expect(hostPortKey(new URL('HTTP://Demo-Target/'))).toBe('demo-target:80');
    expect(hostPortKey(new URL('https://example.com'))).toBe('example.com:443');
    expect(hostPortKey(new URL('http://[::1]:8081/'))).toBe('::1:8081');
  });
});

describe('assertUrlAllowed', () => {
  const none = parsePolicy('');

  it('blocks loopback IP literals', async () => {
    await expect(assertUrlAllowed('http://127.0.0.1:5432/', none)).rejects.toThrow(TargetPolicyError);
  });

  it('blocks the cloud metadata address', async () => {
    await expect(assertUrlAllowed('http://169.254.169.254/latest/meta-data/', parsePolicy('169.254.169.254:80'))).rejects.toThrow(
      /blocked range/,
    );
  });

  it('blocks hostnames that resolve to loopback', async () => {
    await expect(assertUrlAllowed('http://localhost:8081/', none)).rejects.toThrow(TargetPolicyError);
  });

  it('allows an allowlisted host:port and only that port', async () => {
    const policy = parsePolicy('127.0.0.1:8081');
    await expect(assertUrlAllowed('http://127.0.0.1:8081/', policy)).resolves.toBeInstanceOf(URL);
    await expect(assertUrlAllowed('http://127.0.0.1:5432/', policy)).rejects.toThrow(TargetPolicyError);
  });

  it('blocks decimal and hex encodings of loopback', async () => {
    // WHATWG URL parsing normalizes these to 127.0.0.1 before the check runs.
    await expect(assertUrlAllowed('http://2130706433/', none)).rejects.toThrow(TargetPolicyError);
    await expect(assertUrlAllowed('http://0x7f000001/', none)).rejects.toThrow(TargetPolicyError);
  });
});
