import NextAuth, { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const authOptions: AuthOptions = {
  // @ts-ignore
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  session: {
    strategy: "jwt", // Facilita com Google sem forçar sessão só de DB
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.id) {
        (session.user as any).id = token.id; // Garante o ID interno do banco no Frontend
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id; // Armazena o CUID/UUID do banco no token
      }
      return token;
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
