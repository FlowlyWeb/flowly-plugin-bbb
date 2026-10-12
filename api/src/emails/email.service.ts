import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { DeploymentConfig } from '../config/deployment.config';

/**
 * Email context interface
 * Defines the structure of data passed to email templates
 */
export interface EmailContext {
  recipientName?: string;
  supportEmail?: string;
  currentYear?: number;
  platformName?: string;
  frontendUrl?: string;
  [key: string]: unknown;
}

/**
 * Email options interface
 * Configuration for sending an email
 */
export interface EmailOptions {
  to: string;
  subject: string;
  template: string;
  context: EmailContext;
  from?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
}

/**
 * Email service for sending local notifications
 *
 * Handles:
 * - Password resets
 * - Welcome emails
 * - User invitations
 * - Account notifications
 *
 * Uses Handlebars templates with layout system.
 */
@Injectable()
export class EmailService implements OnModuleInit {
  private readonly transporter: nodemailer.Transporter;
  private readonly logger = new Logger(EmailService.name);
  private readonly templatesDir: string;
  private readonly templateCache = new Map<string, HandlebarsTemplateDelegate>();
  private emailsEnabled = true;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('email.host'),
      port: this.configService.get<number>('email.port'),
      secure: this.configService.get<boolean>('email.secure', false),
      auth: {
        user: this.configService.get<string>('email.user'),
        pass: this.configService.get<string>('email.password'),
      },
      debug: this.configService.get<string>('environment') === 'development',
      logger: this.configService.get<string>('environment') === 'development',
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 60000,
      greetingTimeout: 30000,
      socketTimeout: 60000,
    });

    this.templatesDir = path.join(process.cwd(), 'templates/emails');
    this.initializeHandlebarsHelpers();
    this.ensureTemplateDirectoryExists();
  }

  /**
   * Validates SMTP configuration and tests connection on module initialization
   */
  async onModuleInit(): Promise<void> {
    const emailsDisabled = this.configService.get<string>('DISABLE_EMAILS', 'false') === 'true';

    if (emailsDisabled) {
      this.emailsEnabled = false;
      this.logger.warn('Email service disabled (DISABLE_EMAILS=true)');
      return;
    }

    // Validate required config
    const requiredConfig = ['email.host', 'email.user', 'email.password'];
    const missing = requiredConfig.filter((key) => !this.configService.get(key));

    if (missing.length > 0) {
      this.emailsEnabled = false;
      this.logger.warn(
        `Email service disabled — incomplete configuration. Missing: ${missing.join(', ')}. ` +
          'Set EMAIL_HOST, EMAIL_USER and EMAIL_PASSWORD to enable emails.',
      );
      return;
    }

    // Test connection
    const connected = await this.testConnection();
    if (!connected) {
      this.emailsEnabled = false;
      this.logger.warn(
        'Email service disabled — SMTP connection test failed. ' +
          'The API will continue to operate but emails will not be sent.',
      );
      return;
    }

    this.logger.log('SMTP connection verified successfully');
  }

  /**
   * Resolves the full path to a template
   *
   * @param templateName - Template name with optional path (e.g., "auth/welcome")
   * @returns Full path to template file
   */
  private resolveTemplatePath(templateName: string): string {
    if (templateName.includes('/')) {
      return path.join(this.templatesDir, `${templateName}.hbs`);
    }

    const possiblePaths = [
      path.join(this.templatesDir, `${templateName}.hbs`),
      path.join(this.templatesDir, 'auth', `${templateName}.hbs`),
      path.join(this.templatesDir, 'shared', `${templateName}.hbs`),
    ];

    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        return possiblePath;
      }
    }

    return path.join(this.templatesDir, `${templateName}.hbs`);
  }

  /**
   * Loads and compiles a template
   *
   * @param templateName - Name of the template to load
   * @returns Compiled Handlebars template
   */
  private async loadTemplate(
    templateName: string,
  ): Promise<Handlebars.TemplateDelegate<EmailContext> | undefined> {
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName);
    }

    try {
      const templatePath = this.resolveTemplatePath(templateName);

      if (!fs.existsSync(templatePath)) {
        throw new Error(`Template not found: ${templateName} at ${templatePath}`);
      }

      const templateSource = fs.readFileSync(templatePath, 'utf8');
      const compiledTemplate = handlebars.compile(templateSource);

      this.templateCache.set(templateName, compiledTemplate);
      this.logger.debug(`Template loaded and cached: ${templateName}`);

      return compiledTemplate;
    } catch (error) {
      this.logger.error(`Error loading template ${templateName}:`, error);
      throw error;
    }
  }

  /**
   * Compiles email content with layout
   *
   * @param contentTemplate - Content template name
   * @param context - Template context data
   * @param subject - Email subject
   * @returns Compiled HTML string
   */
  private async compileEmailWithLayout(
    contentTemplate: string,
    context: EmailContext,
    subject: string,
  ): Promise<string> {
    try {
      const contentTemplateCompiled = await this.loadTemplate(contentTemplate);
      if (!contentTemplateCompiled) {
        throw new Error(`Content template not found: ${contentTemplate}`);
      }

      const bodyContent = contentTemplateCompiled(context);

      const layoutTemplate = await this.loadTemplate('shared/layout');
      if (!layoutTemplate) {
        throw new Error('Layout template not found in shared/layout');
      }

      const finalContext = {
        ...context,
        body: bodyContent,
        subject: subject,
      };

      return layoutTemplate(finalContext);
    } catch (error) {
      this.logger.error(`Error compiling email with layout:`, error);
      throw error;
    }
  }

  /**
   * Initializes Handlebars helpers for templates
   */
  private initializeHandlebarsHelpers(): void {
    handlebars.registerHelper('formatDate', (date: Date | string) => {
      if (!date) return '';
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return dateObj.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handlebars.registerHelper('ifEquals', function (this: any, arg1: any, arg2: any, options: any) {
      return arg1 == arg2 ? options.fn(this) : options.inverse(this);
    });

    handlebars.registerHelper('capitalize', (str: string) => {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    });
  }

  /**
   * Ensures template directory exists
   */
  private ensureTemplateDirectoryExists(): void {
    if (!fs.existsSync(this.templatesDir)) {
      fs.mkdirSync(this.templatesDir, { recursive: true });
      this.logger.warn(`Templates directory created at: ${this.templatesDir}`);
    }
  }

  /**
   * Prepares default context for all emails
   *
   * @param context - User-provided context
   * @returns Context with defaults merged in
   */
  private prepareContext(context: EmailContext): EmailContext {
    return {
      supportEmail: this.configService.get<string>('email.supportEmail'),
      currentYear: new Date().getFullYear(),
      platformName: 'Flowly',
      frontendUrl: this.configService.get<string>('frontendUrl'),
      ...context,
    };
  }

  /**
   * Sends an email using a template with layout
   *
   * @param options - Email options
   * @returns true if email sent successfully
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.emailsEnabled) {
      this.logger.debug(`Email not sent (service disabled): ${options.subject} → ${options.to}`);
      return false;
    }

    try {
      const finalContext = this.prepareContext(options.context);

      const html = await this.compileEmailWithLayout(
        options.template,
        finalContext,
        options.subject,
      );

      const from = options.from || this.configService.get<string>('email.sender');
      const fromName = this.configService.get<string>('email.senderName', 'Flowly');

      const mailOptions = {
        from: `"${fromName}" <${from}>`,
        to: options.to,
        subject: options.subject,
        html,
        text: this.htmlToText(html),
        attachments: options.attachments || [],
      };

      const info = await this.transporter.sendMail(mailOptions);

      this.logger.log(`Email sent successfully to ${options.to}: ${info.messageId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}:`, error);
      return false;
    }
  }

  /**
   * Sends a welcome email to a new user (SaaS only)
   *
   * @param to - Recipient email address
   * @param userName - User's name
   * @param institutionName - Institution name
   * @returns true if email sent successfully
   */
  async sendWelcomeEmail(to: string, userName: string, institutionName: string): Promise<boolean> {
    // SAAS only - skip welcome email for on-premise deployments
    if (DeploymentConfig.isOnPremise) {
      this.logger.debug('Skipping welcome email (on-premise deployment)');
      return true;
    }

    return this.sendEmail({
      to,
      subject: 'Bienvenue sur Flowly !',
      template: 'auth/welcome',
      context: {
        recipientName: userName,
        institutionName,
      },
    });
  }

  /**
   * Sends a password reset email
   *
   * @param to - Recipient email address
   * @param resetToken - Password reset token
   * @param resetUrl - Base URL for password reset
   * @returns true if email sent successfully
   */
  async sendPasswordResetEmail(to: string, resetToken: string, resetUrl: string): Promise<boolean> {
    const resetLink = `${resetUrl}?token=${resetToken}`;

    return this.sendEmail({
      to,
      subject: 'Réinitialisation de votre mot de passe Flowly',
      template: 'auth/password-reset',
      context: {
        resetLink,
      },
    });
  }

  /**
   * Sends a password changed confirmation email
   *
   * @param to - Recipient email address
   * @param userName - User's name
   * @returns true if email sent successfully
   */
  async sendPasswordChangedEmail(to: string, userName: string): Promise<boolean> {
    return this.sendEmail({
      to,
      subject: 'Votre mot de passe Flowly a été modifié',
      template: 'auth/password-changed',
      context: {
        recipientName: userName,
        createdAt: new Date(),
      },
    });
  }

  /**
   * Sends a quota exceeded notification email (SaaS only)
   *
   * @param to - Recipient email address
   * @param institutionName - Institution name
   * @param quotaType - Type of quota exceeded (e.g., "Serveurs")
   * @param quotaLimit - Maximum allowed quota
   * @param currentUsage - Current usage count
   * @returns true if email sent successfully
   */
  async sendQuotaExceededEmail(
    to: string,
    institutionName: string,
    quotaType: string,
    quotaLimit: number,
    currentUsage: number,
  ): Promise<boolean> {
    if (DeploymentConfig.isOnPremise) {
      this.logger.debug('Skipping quota exceeded email (on-premise deployment)');
      return true;
    }

    const excessAmount = currentUsage - quotaLimit;

    return this.sendEmail({
      to,
      subject: `Limite de quota atteinte - ${institutionName}`,
      template: 'notifications/quota-exceeded',
      context: {
        institutionName,
        quotaType,
        quotaLimit: String(quotaLimit),
        currentUsage: String(currentUsage),
        excessAmount: String(excessAmount > 0 ? excessAmount : 0),
      },
    });
  }

  /**
   * Converts HTML to plain text for email text alternative
   *
   * @param html - HTML string
   * @returns Plain text string
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Clears the template cache (useful in development)
   */
  clearTemplateCache(): void {
    this.templateCache.clear();
    this.logger.log('Template cache cleared');
  }

  /**
   * Tests SMTP connection
   *
   * @returns true if connection successful
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      this.logger.log('SMTP connection successful');
      return true;
    } catch (error) {
      this.logger.error('SMTP connection failed:', error);
      return false;
    }
  }
}
