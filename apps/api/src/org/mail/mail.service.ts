import { Inject, Injectable, Logger } from "@nestjs/common";
import { createTransport, type Transporter } from "nodemailer";
import { DomainException } from "../../common/domain-exception";
import { AppConfigService } from "../../config/app-config.service";

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

/**
 * Minimal SMTP mailer for invite links. In dev the transport points at Mailhog
 * (docker-compose); no TLS/auth. A delivery failure surfaces as `503 DIZZY_OWL`
 * — invite creation is atomic with the send (both run in the request handler).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;

  constructor(@Inject(AppConfigService) private readonly config: AppConfigService) {
    this.transporter = createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: false,
    });
  }

  async sendInvite(input: {
    email: string;
    orgName: string;
    role: string;
    link: string;
  }): Promise<void> {
    const { email, orgName, role, link } = input;
    // Escape interpolated user-controlled values (org name) in the HTML part so a
    // crafted org name can't inject markup into the recipient's mail client.
    const org = escapeHtml(orgName);
    try {
      await this.transporter.sendMail({
        from: this.config.mailFrom,
        to: email,
        subject: `You're invited to ${orgName} on togglr`,
        text: `You've been invited to join ${orgName} as ${role}.\n\nAccept your invite: ${link}\n`,
        html: `<p>You've been invited to join <strong>${org}</strong> as <strong>${escapeHtml(role)}</strong>.</p><p><a href="${escapeHtml(link)}">Accept your invite</a></p>`,
      });
    } catch (err) {
      this.logger.error(`invite email to ${email} failed: ${(err as Error).message}`);
      throw new DomainException("DIZZY_OWL", 503, "mail delivery unavailable");
    }
  }
}
