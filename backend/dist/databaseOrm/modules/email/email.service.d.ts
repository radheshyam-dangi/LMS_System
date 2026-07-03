import { OnModuleInit } from '@nestjs/common';
export declare class EmailService implements OnModuleInit {
    private transporter;
    private readonly JWT_SECRET;
    onModuleInit(): Promise<void>;
    sendInvitationEmail(dto: {
        to: string;
        subject: string;
        firstName: string;
        lastName: string;
        roles: string[];
        isPrimary: string;
        senderName: string;
        senderEmail: string;
    }): Promise<{
        previewUrl: string | false;
    }>;
}
