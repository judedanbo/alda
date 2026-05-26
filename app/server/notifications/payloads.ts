/**
 * Shared payload builders — one place for every notification's title,
 * message, and metadata. The `notifyXxx` helpers in
 * notification.service.ts call these so per-type copy doesn't get
 * forked across the codebase.
 *
 * Each builder returns a partial NotificationPayload (no userId, type,
 * or channels — those are owned by the caller).
 */

export interface NotificationCopy {
  title: string;
  message: string;
  metadata: Record<string, unknown>;
}

export const payloads = {
  uniqueCodeGenerated(args: { uniqueCode: string; name: string }): NotificationCopy {
    // M-5: the title becomes the email Subject (notification.service.ts).
    // Keep the code out of the subject — bodies/metadata still carry it
    // for in-app rendering.
    return {
      title: "Your Declaration Code Is Ready",
      message: `Your unique declaration code is ${args.uniqueCode}. Keep this code safe for tracking your declaration.`,
      metadata: { uniqueCode: args.uniqueCode, name: args.name },
    };
  },

  formCollected(args: { uniqueCode: string; collectionOffice: string; declarationId: string }): NotificationCopy {
    return {
      title: "Declaration Form Collected",
      message: `Your asset declaration form (${args.uniqueCode}) has been collected from ${args.collectionOffice}. Please complete and return it.`,
      metadata: {
        declarationId: args.declarationId,
        uniqueCode: args.uniqueCode,
        collectionOffice: args.collectionOffice,
      },
    };
  },

  declarationSubmitted(args: { uniqueCode: string; name: string }): NotificationCopy {
    return {
      title: "Declaration Submitted",
      message: `Your declaration (${args.uniqueCode}) has been submitted for review.`,
      metadata: {
        uniqueCode: args.uniqueCode,
        name: args.name,
        submittedAt: new Date().toISOString(),
      },
    };
  },

  sectionReviewComments(args: { uniqueCode: string; declarationId: string; issueCount: number }): NotificationCopy {
    return {
      title: "Declaration Review — Issues Found",
      message: `Your asset declaration (${args.uniqueCode}) has been reviewed. ${args.issueCount} section(s) require attention. Please visit your declaration page for details.`,
      metadata: {
        declarationId: args.declarationId,
        uniqueCode: args.uniqueCode,
      },
    };
  },

  declarationApproved(args: { uniqueCode: string; name: string; declarationId?: string }): NotificationCopy {
    return {
      title: "Declaration Approved",
      message: `Your asset declaration (${args.uniqueCode}) has been approved. A receipt will be generated shortly.`,
      metadata: {
        uniqueCode: args.uniqueCode,
        name: args.name,
        ...(args.declarationId ? { declarationId: args.declarationId } : {}),
        approvedAt: new Date().toISOString(),
      },
    };
  },

  declarationRejected(args: {
    uniqueCode: string;
    name: string;
    reason: string;
    newCode?: string;
    declarationId?: string;
  }): NotificationCopy {
    const newCodeSuffix = args.newCode ? ` A new code has been issued: ${args.newCode}.` : "";
    return {
      title: args.newCode ? "Declaration Requires Revision" : "Declaration Rejected",
      message: args.newCode
        ? `Your asset declaration (${args.uniqueCode}) requires revision. Reason: ${args.reason}.${newCodeSuffix}`
        : `Your declaration (${args.uniqueCode}) requires attention. Reason: ${args.reason}`,
      metadata: {
        uniqueCode: args.uniqueCode,
        name: args.name,
        rejectionReason: args.reason,
        ...(args.newCode ? { newCode: args.newCode } : {}),
        ...(args.declarationId ? { declarationId: args.declarationId } : {}),
      },
    };
  },

  formReissueRequested(args: { uniqueCode: string; name: string }): NotificationCopy {
    return {
      title: "Reissue Request Received",
      message: `We received your request to reissue the lost form for declaration (${args.uniqueCode}). The Legal Unit will process it once the Auditor General's approval letter is received.`,
      metadata: {
        uniqueCode: args.uniqueCode,
        name: args.name,
        requestedAt: new Date().toISOString(),
      },
    };
  },

  formReissueApproved(args: { uniqueCode: string; name: string }): NotificationCopy {
    return {
      title: "Form Reissue Approved",
      message: `Your request to reissue the lost form for declaration (${args.uniqueCode}) has been approved. Collect the reissued form and return it through the normal process.`,
      metadata: {
        uniqueCode: args.uniqueCode,
        name: args.name,
        approvedAt: new Date().toISOString(),
      },
    };
  },

  formReissueDeclined(args: { uniqueCode: string; name: string; reason: string }): NotificationCopy {
    return {
      title: "Form Reissue Declined",
      message: `Your request to reissue the lost form for declaration (${args.uniqueCode}) was declined. Reason: ${args.reason}`,
      metadata: {
        uniqueCode: args.uniqueCode,
        name: args.name,
        decisionReason: args.reason,
      },
    };
  },

  receiptReady(args: {
    uniqueCode: string;
    receiptNumber: string;
    name: string;
    declarationId?: string;
    pdfUrl?: string;
  }): NotificationCopy {
    return {
      title: "Receipt Ready",
      message: `Your receipt (${args.receiptNumber}) for declaration ${args.uniqueCode} is ready.`,
      metadata: {
        uniqueCode: args.uniqueCode,
        receiptNumber: args.receiptNumber,
        name: args.name,
        ...(args.declarationId ? { declarationId: args.declarationId } : {}),
        ...(args.pdfUrl ? { pdfUrl: args.pdfUrl } : {}),
      },
    };
  },

  verificationSubmitted(args: { name: string }): NotificationCopy {
    return {
      title: "Registration Under Review",
      message: "Your registration is now being reviewed by the legal office.",
      metadata: { name: args.name },
    };
  },

  verificationStatus(args: {
    status: "VERIFIED" | "ON_HOLD" | "MORE_INFO_REQUIRED" | "REJECTED";
    name: string;
    reason: string;
    messageToApplicant?: string;
    dashboardUrl: string;
  }): NotificationCopy {
    const titleMap: Record<typeof args.status, string> = {
      VERIFIED: "Registration Verified",
      ON_HOLD: "Registration Under Investigation",
      MORE_INFO_REQUIRED: "Additional Information Required",
      REJECTED: "Registration Not Approved",
    };
    const messageMap: Record<typeof args.status, string> = {
      VERIFIED: "Your registration has been verified. You can now create asset declarations.",
      ON_HOLD: `Your registration is under investigation. Reason: ${args.reason}`,
      MORE_INFO_REQUIRED: `Additional information required: ${args.messageToApplicant || args.reason}`,
      REJECTED: `Your registration was not approved. Reason: ${args.reason}`,
    };
    return {
      title: titleMap[args.status],
      message: messageMap[args.status],
      metadata: {
        name: args.name,
        reason: args.reason,
        messageToApplicant: args.messageToApplicant,
        dashboardUrl: args.dashboardUrl,
      },
    };
  },
};
