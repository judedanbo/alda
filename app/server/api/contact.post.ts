import { z } from "zod";
import prisma from "~/server/utils/prisma";
import { sendContactAcknowledgment } from "~/server/services/email.service";

const contactSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(255),
  email: z.string().email("Invalid email address").max(255),
  phone: z.string().max(20).optional(),
  category: z.enum([
    "GENERAL_INQUIRY",
    "TECHNICAL_SUPPORT",
    "DECLARATION_HELP",
    "FEEDBACK",
    "COMPLAINT",
    "OTHER",
  ]).default("GENERAL_INQUIRY"),
  subject: z.string().min(5, "Subject must be at least 5 characters").max(255),
  message: z.string().min(10, "Message must be at least 10 characters").max(2000),
});

export default defineEventHandler(async (event) => {
  // Parse and validate request body
  const body = await readBody(event);

  const result = contactSchema.safeParse(body);
  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: result.error.errors[0]?.message || "Invalid form data",
    });
  }

  const { name, email, phone, category, subject, message } = result.data;

  // Get client information
  const ipAddress = getHeader(event, "x-forwarded-for")?.split(",")[0]?.trim()
    || getHeader(event, "x-real-ip")
    || "unknown";
  const userAgent = getHeader(event, "user-agent") || "unknown";

  try {
    // Save contact submission to database
    const submission = await prisma.contactSubmission.create({
      data: {
        name,
        email,
        phone,
        category,
        subject,
        message,
        ipAddress,
        userAgent,
      },
    });

    try {
      await sendContactAcknowledgment(data.email, data.name, data.category);
    } catch (e) {
      console.error("Failed to send contact acknowledgment:", e);
    }

    return {
      success: true,
      message: "Your message has been submitted successfully",
      data: {
        id: submission.id,
        referenceNumber: `CNT-${submission.id.slice(0, 8).toUpperCase()}`,
      },
    };
  } catch (error) {
    console.error("Failed to save contact submission:", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Internal Server Error",
      message: "Failed to submit your message. Please try again later.",
    });
  }
});
