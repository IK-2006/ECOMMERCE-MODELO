import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
    /** epoch ms do login — usado para limitar a duração da sessão admin */
    loginAt?: number;
  }

  interface User {
    role?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    /** epoch ms do login (fixado no sign-in, preservado nas rotações) */
    loginAt?: number;
  }
}
