import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
    };
    error?: 'UserNotFound';
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    passwordHash?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    lastValidated?: number;
    userInvalid?: boolean;
  }
}
