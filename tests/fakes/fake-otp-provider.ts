export class FakeOtpProvider {
  private sequence = 100000;
  private readonly codes = new Map<string, string>();

  constructor(private readonly beforeCheck?: () => void) {}

  async sendCode(phone: string): Promise<void> {
    this.sequence += 1;
    this.codes.set(phone, String(this.sequence));
  }

  async checkCode(phone: string, code: string): Promise<boolean> {
    this.beforeCheck?.();
    return this.codes.get(phone) === code;
  }

  latestCode(phone: string): string {
    const code = this.codes.get(phone);
    if (!code) {
      throw new Error(`No OTP was sent to ${phone}`);
    }
    return code;
  }
}
