"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const common_1 = require("@nestjs/common");
const nodemailer = __importStar(require("nodemailer"));
const jwt = __importStar(require("jsonwebtoken"));
let EmailService = class EmailService {
    transporter;
    JWT_SECRET = process.env.JWT_SECRET || 'your-secure-invitation-secret-key';
    async onModuleInit() {
        try {
            // Automatically creates a dynamic dummy account from Ethereal on the fly
            const testAccount = await nodemailer.createTestAccount();
            console.log('------------------------------------------------------');
            console.log('Ethereal Dynamic Account Created Successfully!');
            console.log(`Username: ${testAccount.user}`);
            console.log(`Password: ${testAccount.pass}`);
            console.log('------------------------------------------------------');
            this.transporter = nodemailer.createTransport({
                host: testAccount.smtp.host,
                port: testAccount.smtp.port,
                secure: testAccount.smtp.secure,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass
                },
            });
        }
        catch (error) {
            console.error('Failed to provision Ethereal test environment account:', error);
        }
    }
    async sendInvitationEmail(dto) {
        const invitationToken = jwt.sign({
            email: dto.to,
            firstName: dto.firstName,
            lastName: dto.lastName,
            roles: dto.roles,
            isPrimary: dto.isPrimary
        }, this.JWT_SECRET, { expiresIn: '24h' });
        const frontendAcceptUrl = `http://localhost:5173/set-password?token=${invitationToken}`;
        const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #333;">Welcome to the Tech Team, ${dto.firstName}!</h2>
        <p style="color: #555; font-size: 14px; margin-bottom: 20px;">
          You have been invited by <strong>${dto.senderName}</strong> (${dto.senderEmail}) to join our workspace.
        </p>
        <p>We are excited to have you join us to contribute within our team. Please verify your details below:</p>
        <table style="width: 100%; margin-bottom: 20px; border-collapse: collapse;">
          <tr><td style="padding: 5px 0; font-weight: bold;">Name:</td><td>${dto.firstName} ${dto.lastName}</td></tr>
          <tr><td style="padding: 5px 0; font-weight: bold;">Assigned Roles:</td><td>${dto.roles.join(', ')}</td></tr>
          <tr><td style="padding: 5px 0; font-weight: bold;">Primary Role:</td><td><span style="background: #e1f5fe; color: #0288d1; padding: 2px 6px; border-radius: 3px;">${dto.isPrimary}</span></td></tr>
        </table>
        <p style="margin-bottom: 30px;">Click the button below to accept your invitation and securely set up your account password.</p>
        <div style="text-align: center;">
          <a href="${frontendAcceptUrl}" style="background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block;">Accept & Set Password</a>
        </div>
      </div>
    `;
        try {
            const info = await this.transporter.sendMail({
                // Maps the targeted admin custom email details natively
                from: `"${dto.senderName}" <${dto.senderEmail}>`,
                to: dto.to, // Displays target user on UI layout screen
                subject: dto.subject,
                html: htmlContent,
            });
            // Generates the browser execution preview URL string 
            const previewUrl = nodemailer.getTestMessageUrl(info);
            console.log('\n========= EMAIL SENT (SANDBOX) =========');
            console.log(`From: "${dto.senderName}" <${dto.senderEmail}>`);
            console.log(`To: <${dto.to}>`);
            console.log(`Direct Preview Link: ${previewUrl}`);
            console.log('========================================\n');
            return { success: true, previewUrl };
        }
        catch (error) {
            console.error('Failed to send mock invitation payload:', error);
            throw new common_1.InternalServerErrorException('Email service sandbox is temporarily offline');
        }
    }
};
exports.EmailService = EmailService;
exports.EmailService = EmailService = __decorate([
    (0, common_1.Injectable)()
], EmailService);
//# sourceMappingURL=email.service.js.map