import { EmailService } from './email.service';
declare class SendInvitationDto {
    to: string;
    subject: string;
    firstName: string;
    lastName: string;
    roles: string[];
    isPrimary: string;
    senderName: string;
    senderEmail: string;
}
export declare class EmailController {
    private readonly emailService;
    constructor(emailService: EmailService);
    sendEmail(invitationDto: SendInvitationDto): Promise<{
        previewUrl: string | false;
    }>;
}
export {};
