import type { GlossaryTerm } from "./types";

export const glossaryTerms: GlossaryTerm[] = [
  {
    id: "gl-article-286",
    term: "Article 286(5)",
    definition:
      "The provision of Chapter 24 of Ghana's 1992 Constitution requiring specified public officers to declare their assets and liabilities. The portal exists to support this compliance process.",
    aliases: ["asset declaration law"],
  },
  {
    id: "gl-act-550",
    term: "Act 550",
    definition:
      "The Public Office Holders (Declaration of Assets and Disqualification) Act, 1998. The statute that gives effect to Chapter 24 of the Constitution — setting out who must declare (Schedule I), what must be declared (Section 4), when (Section 1(4)), the form to use (Schedule II), and the consequences of contravention (Sections 7–8 and Part II).",
    aliases: ["the Act", "declaration act", "1998 Act"],
  },
  {
    id: "gl-schedule-i",
    term: "Schedule I",
    definition:
      "The schedule of Act 550 that lists the public offices subject to declaration — the President and Vice-President, Speaker, MPs, Ministers, judges, Ambassadors, heads of MDAs and corporations, MMDA executives, senior revenue and security officers, and any public officer with a salary at or above that of a Director in the Civil Service.",
  },
  {
    id: "gl-schedule-ii",
    term: "Schedule II",
    definition:
      "The Declaration of Assets and Liability form referenced by Section 1(2) of Act 550. Inside the portal the same information is captured through the structured declaration workflow.",
    aliases: ["declaration form"],
  },
  {
    id: "gl-chraj",
    term: "CHRAJ",
    definition:
      "The Commissioner for Human Rights and Administrative Justice. Under Section 8 of Act 550, allegations that a public officer has contravened the declaration requirements are made to CHRAJ for investigation. When the Commissioner is the subject, the complaint goes to the Chief Justice.",
    aliases: ["Commissioner for Human Rights and Administrative Justice"],
  },
  {
    id: "gl-disqualification",
    term: "Disqualification",
    definition:
      "Under Part II of Act 550, a person who is the subject of an adverse commission-of-inquiry finding (unlawful acquisition, defrauding the State, prejudicial conduct, or a knowingly false declaration), or who is convicted of certain serious offences, does not qualify to hold any of the offices listed in Schedule I.",
  },
  {
    id: "gl-declaration",
    term: "Declaration",
    definition:
      "A single asset-declaration case. It is created by an applicant, identified by a unique code, and moves through the declaration workflow until it is sealed.",
  },
  {
    id: "gl-unique-code",
    term: "Unique code",
    definition:
      "The identifier generated when a declaration is created. Applicants use it to collect their form; officers and the Legal Unit use it to look up a declaration.",
    aliases: ["code", "declaration code"],
  },
  {
    id: "gl-code-generated",
    term: "Code Generated",
    definition:
      "The first declaration status. The applicant has created the declaration and received a unique code, but the physical form has not yet been collected.",
  },
  {
    id: "gl-form-collected",
    term: "Form Collected",
    definition:
      "The status after a Schedule Officer records that the applicant collected the physical form. Lost-form reissue requests are only possible at this stage.",
  },
  {
    id: "gl-submitted",
    term: "Submitted",
    definition:
      "The status after the completed physical form has been returned and recorded by a Schedule Officer. The declaration is now ready for review.",
  },
  {
    id: "gl-under-review",
    term: "Under Review",
    definition:
      "The status while a Schedule Officer reviews the declaration section by section. It stays here until all flagged issues are resolved.",
  },
  {
    id: "gl-approved",
    term: "Approved",
    definition:
      "The status after a Schedule Officer approves a reviewed declaration. The next and final step is generating the receipt.",
  },
  {
    id: "gl-sealed",
    term: "Sealed",
    definition:
      "The final status of a successful declaration, reached when its receipt is generated.",
  },
  {
    id: "gl-rejected",
    term: "Rejected",
    definition:
      "The status when a Schedule Officer rejects a declaration during review. A fresh unique code is issued automatically so the applicant can start again.",
  },
  {
    id: "gl-collection-office",
    term: "Collection Office",
    definition:
      "The Audit Service office a physical declaration form is collected from. The Schedule Officer records it when logging a form collection.",
    roles: ["schedule_officer", "admin"],
  },
  {
    id: "gl-receipt",
    term: "Receipt",
    definition:
      "The sealed PDF document generated for an approved declaration, carrying a receipt number and seal number.",
  },
  {
    id: "gl-section-review",
    term: "Section review",
    definition:
      "The review of one of the declaration form's eight sections. Each section is marked acceptable or flagged with a comment.",
    roles: ["schedule_officer", "admin"],
  },
  {
    id: "gl-registration-verification",
    term: "Registration verification",
    definition:
      "The Legal Unit's review of an applicant's profile, deciding whether the applicant may create declarations.",
  },
  {
    id: "gl-verified",
    term: "Verified",
    definition:
      "A registration outcome meaning the applicant's profile has been confirmed and they may now create declarations.",
  },
  {
    id: "gl-on-hold",
    term: "On Hold",
    definition:
      "A registration outcome that pauses a registration. The applicant sees the reason but is not asked for anything specific.",
  },
  {
    id: "gl-more-info",
    term: "More Information Required",
    definition:
      "A registration outcome asking the applicant to update specific details before the registration can proceed.",
  },
  {
    id: "gl-form-reissue",
    term: "Form reissue",
    definition:
      "The process for replacing a physical form that an applicant lost after collection. It requires an offline approval from the Auditor General or a Regional Auditor.",
  },
  {
    id: "gl-auditor-general",
    term: "Auditor General",
    definition:
      "A senior approver whose offline signed letter can authorise a lost-form reissue. A Regional Auditor can also provide this approval.",
  },
  {
    id: "gl-audit-log",
    term: "Audit log",
    definition:
      "An immutable record of every state-changing action in the portal. Audit logs cannot be edited or deleted and are a compliance requirement.",
    roles: ["admin"],
  },
];
