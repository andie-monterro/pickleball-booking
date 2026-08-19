export class FakeOtpProvider {
  private sequence = 100000;
  private readonly codes = new Map<string, string>();
  private sendFailure: Error | null = null;
  private checkFailure: Error | null = null;

  constructor(private readonly beforeCheck?: () => void) {}

  failSending(error = new Error("Fake OTP provider unavailable")): void {
    this.sendFailure = error;
  }

  failChecking(error = new Error("Fake OTP provider unavailable")): void {
    this.checkFailure = error;
  }

  async sendCode(phone: string): Promise<void> {
    if (this.sendFailure) {
      throw this.sendFailure;
    }
    this.sequence += 1;
    this.codes.set(phone, String(this.sequence));
  }

  async checkCode(phone: string, code: string): Promise<boolean> {
    if (this.checkFailure) {
      throw this.checkFailure;
    }
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
