import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIpFromForwardedFor } from "@/lib/rate-limit";
import { verifyToken } from "@/lib/totp";
import { audit } from "@/lib/audit";

// erro especial: senha correta mas falta o código 2FA — o formulário de
// login usa isso para revelar o campo do código.
export const TWO_FACTOR_REQUIRED = "2FA_REQUIRED";

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "credentials",
    credentials: {
      email: { label: "E-mail", type: "email" },
      password: { label: "Senha", type: "password" },
      totp: { label: "Código de verificação", type: "text" },
    },
    async authorize(credentials, req) {
      const email = credentials?.email?.trim().toLowerCase();
      const password = credentials?.password;
      if (!email || !password) return null;

      // IP real (à direita do XFF, anexado pelo proxy) — não confia no
      // valor da esquerda, que o cliente pode falsificar para burlar o limite.
      const ip = clientIpFromForwardedFor(
        (req?.headers?.["x-forwarded-for"] as string | undefined) ?? null,
        (req?.headers?.["x-real-ip"] as string | undefined) ?? null
      );

      const user = await prisma.user.findUnique({ where: { email } });
      const validPassword = Boolean(
        user?.passwordHash && (await bcrypt.compare(password, user.passwordHash))
      );

      // Rate limit: conta apenas TENTATIVAS FALHAS (5 por e-mail / 20 por IP
      // a cada 15 min) — o login legítimo de 2 passos não consome o limite.
      if (!validPassword) {
        const byEmail = rateLimit(`login:email:${email}`, 5, 15 * 60 * 1000);
        const byIp = rateLimit(`login:ip:${ip}`, 20, 15 * 60 * 1000);
        if (!byEmail.ok || !byIp.ok) {
          void audit({
            action: "auth.blocked",
            entity: "Auth",
            detail: { email, reason: "brute_force" },
            ip,
          });
          throw new Error("Muitas tentativas de login. Tente novamente em alguns minutos.");
        }
        return null;
      }

      // Senha correta — exige o segundo fator, se ativo
      if (user!.twoFactorEnabled && user!.twoFactorSecret) {
        const totp = credentials?.totp?.trim();
        if (!totp) throw new Error(TWO_FACTOR_REQUIRED);
        if (!verifyToken(totp, user!.twoFactorSecret)) {
          const byEmail = rateLimit(`login:2fa:${email}`, 5, 15 * 60 * 1000);
          if (!byEmail.ok) {
            throw new Error("Muitas tentativas. Tente novamente em alguns minutos.");
          }
          throw new Error("Código de verificação inválido");
        }
      }

      void audit({
        userId: user!.id,
        action: "auth.login",
        entity: "Auth",
        entityId: user!.id,
        detail: { method: "credentials" },
        ip,
      });

      return {
        id: user!.id,
        name: user!.name,
        email: user!.email,
        image: user!.image,
        role: user!.role,
      };
    },
  }),
];

// Login social Google — ativado apenas se as credenciais existirem no .env
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

export const authOptions: NextAuthOptions = {
  providers,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: "/entrar",
    error: "/entrar",
  },
  callbacks: {
    // Google: garante que o usuário exista no banco (upsert por e-mail)
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        const dbUser = await prisma.user.upsert({
          where: { email: user.email },
          update: { image: user.image ?? undefined, emailVerified: new Date() },
          create: {
            email: user.email,
            name: user.name ?? user.email.split("@")[0],
            image: user.image,
            emailVerified: new Date(),
          },
        });
        user.id = dbUser.id;
        (user as { role?: string }).role = dbUser.role;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "CUSTOMER";
        // fixado no login e preservado nas rotações — base do limite admin
        token.loginAt = Date.now();
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      session.loginAt = token.loginAt;
      return session;
    },
  },
  // Trilha de auditoria de autenticação (login social e logout).
  // O login por credenciais é logado dentro de `authorize` (com IP).
  events: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        void audit({
          userId: user.id,
          action: "auth.login",
          entity: "Auth",
          entityId: user.id,
          detail: { method: "google" },
        });
      }
    },
    async signOut({ token }) {
      void audit({
        userId: (token as { id?: string })?.id ?? null,
        action: "auth.logout",
        entity: "Auth",
      });
    },
  },
};
