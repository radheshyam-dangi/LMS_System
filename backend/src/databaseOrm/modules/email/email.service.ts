import { Injectable, OnModuleInit, InternalServerErrorException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class EmailService implements OnModuleInit {
  private transporter: nodemailer.Transporter;
  
  // TODO: In production, pull these from ConfigService: this.configService.get('JWT_SECRET')
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'your-secure-invitation-secret-key'; 

  async onModuleInit() {
    // REMOVED: nodemailer.createTestAccount() call to speed up startup
    this.transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { 
        user: process.env.SMTP_USER || 'evie.treutel70@ethereal.email', 
        pass: process.env.SMTP_PASS || 'KBm4fNz1U7X5HwGMrF' 
      },
    });
  }

  async sendInvitationEmail(dto: {
    to: string;
    subject: string;
    firstName: string;
    lastName: string;
    roles: string[];
    isPrimary: string;
    senderName: string;   
    senderEmail: string;  
  }) {
    // 1. Generate a secure invitation token valid for 24 hours
    const invitationToken = jwt.sign(
      { 
        email: dto.to, 
        firstName: dto.firstName, 
        lastName: dto.lastName, 
        roles: dto.roles, 
        isPrimary: dto.isPrimary 
      },
      this.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // 2. Frontend application URL route
    const frontendAcceptUrl = `http://localhost:5173/set-password?token=${invitationToken}`;

    // 3. Build HTML template
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

    // 4. Send the mail wrapped in a try/catch block
    try {
      const info = await this.transporter.sendMail({
        // Best practice: Name comes from dynamic sender, but email address matches your authorized SMTP user domain
        from: `"${dto.senderName}" ${dto.senderEmail}`, 
        // replyTo: dto.senderEmail, // ◄ Allows recipient to reply directly to the person who invited them
        to: dto.to,
        subject: dto.subject,
        html: htmlContent, 
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log('Preview Link: %s', previewUrl);
      return { success: true, previewUrl };

    } catch (error) {
      console.error('Failed to send invitation email:', error);
      throw new InternalServerErrorException('Email service is temporarily unavailable');
    }
  }
}