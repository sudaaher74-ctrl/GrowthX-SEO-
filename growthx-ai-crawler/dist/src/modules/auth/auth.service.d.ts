import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { OrganizationsService } from '../organizations/organizations.service';
export declare class AuthService {
    private usersService;
    private jwtService;
    private organizationsService;
    constructor(usersService: UsersService, jwtService: JwtService, organizationsService: OrganizationsService);
    validateUser(email: string, pass: string): Promise<any>;
    login(user: any): Promise<{
        access_token: string;
    }>;
    register(data: any): Promise<{
        access_token: string;
    }>;
}
