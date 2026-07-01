import { CompleteSignupDto } from './dto/completeSignup.dto';
import { AuthService } from './auth.service';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    completeSignup(token: string, dto: CompleteSignupDto): Promise<{
        message: string;
    }>;
}
