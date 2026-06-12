import prisma from "~/server/utils/prisma";
import { generateVerificationToken } from "~/server/utils/code-generator";
import { sendVerificationEmail } from "~/server/services/email.service";

/**
 * Issue a fresh email-verification token for a user and send the verification
 * email to the given address. Any outstanding tokens for the user are
 * invalidated first so only the latest link works.
 *
 * Shared by `auth/resend-verification.post.ts` (user-requested resend) and
 * `account/contact.patch.ts` (re-verification triggered by an email change).
 * The email send is best-effort: a transport failure is logged but does not
 * throw, so the surrounding mutation still succeeds.
 */
export async function issueEmailVerification(userId: string, email: string): Promise<void> {
  await prisma.emailVerificationToken.deleteMany({ where: { userId } });

  const token = generateVerificationToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  await prisma.emailVerificationToken.create({
    data: { userId, token, expiresAt },
  });

  try {
    await sendVerificationEmail(email, email, token);
  } catch (e) {
    console.error("Failed to send verification email:", e);
  }
}
