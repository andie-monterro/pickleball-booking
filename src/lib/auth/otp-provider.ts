export interface OtpProvider {
  sendCode(phone: string): Promise<void>;
  checkCode(phone: string, code: string): Promise<boolean>;
}

const PRELUDE_API_URL = "https://api.prelude.dev/v2/verification";

class PreludeOtpProvider implements OtpProvider {
  private apiKey(): string {
    const apiKey = process.env.PRELUDE_API_KEY;
    if (!apiKey) {
      throw new Error("PRELUDE_API_KEY is not set");
    }
    return apiKey;
  }

  private async post(path: string, body: unknown): Promise<Response> {
    const response = await fetch(`${PRELUDE_API_URL}${path}`, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${this.apiKey()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`OTP delivery provider returned ${response.status}`);
    }
    return response;
  }

  async sendCode(phone: string): Promise<void> {
    const response = await this.post("", {
      target: { type: "phone_number", value: phone },
      options: { method: "message" },
    });
    const result: unknown = await response.json();
    const status =
      typeof result === "object" && result !== null && "status" in result
        ? result.status
        : null;
    if (
      status !== "success" &&
      status !== "retry" &&
      status !== "shadow_blocked"
    ) {
      throw new Error("OTP delivery provider did not send a code");
    }
  }

  async checkCode(phone: string, code: string): Promise<boolean> {
    const response = await this.post("/check", {
      target: { type: "phone_number", value: phone },
      code,
    });
    const result: unknown = await response.json();
    return (
      typeof result === "object" &&
      result !== null &&
      "status" in result &&
      result.status === "success"
    );
  }
}

let currentProvider: OtpProvider | undefined;

export function getOtpProvider(): OtpProvider {
  currentProvider ??= new PreludeOtpProvider();
  return currentProvider;
}

export function setOtpProvider(provider: OtpProvider): void {
  currentProvider = provider;
}

export function resetOtpProvider(): void {
  currentProvider = undefined;
}
