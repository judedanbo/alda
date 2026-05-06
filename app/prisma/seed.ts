import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // Seed Roles
  console.log("Creating roles...");
  const roles = await Promise.all([
    prisma.role.upsert({
      where: { name: "applicant" },
      update: {},
      create: {
        name: "applicant",
        description: "Public official submitting asset declaration",
      },
    }),
    prisma.role.upsert({
      where: { name: "schedule_officer" },
      update: {},
      create: {
        name: "schedule_officer",
        description: "GAS Schedule Officer - processes submissions and reviews",
      },
    }),
    prisma.role.upsert({
      where: { name: "legal_unit" },
      update: {},
      create: {
        name: "legal_unit",
        description: "Legal Unit - verifies authenticity and recalls information",
      },
    }),
    prisma.role.upsert({
      where: { name: "admin" },
      update: {},
      create: {
        name: "admin",
        description: "System administrator with full access",
      },
    }),
  ]);
  console.log(`✅ Created ${roles.length} roles`);

  // Seed Public Office Categories (Article 286(5) of Ghana Constitution)
  console.log("Creating public office categories...");
  const categories = [
    {
      name: "President and Vice President",
      description: "The President and Vice-President of the Republic",
      articleReference: "Article 286(5)(a)",
    },
    {
      name: "Speaker, Deputy Speakers and Members of Parliament",
      description: "Speaker, Deputy Speakers and Members of Parliament",
      articleReference: "Article 286(5)(b)",
    },
    {
      name: "Ministers and Deputy Ministers",
      description: "Ministers of State and Deputy Ministers",
      articleReference: "Article 286(5)(c)",
    },
    {
      name: "Chief Justice and Justices of Superior Courts",
      description: "Chief Justice and other Justices of the Superior Courts of Judicature",
      articleReference: "Article 286(5)(d)",
    },
    {
      name: "Chairmen and Deputy Chairmen of Councils",
      description: "Chairman and Deputy Chairmen of a Regional Tribunal",
      articleReference: "Article 286(5)(e)",
    },
    {
      name: "Ambassador or High Commissioner",
      description: "Ambassador or High Commissioner",
      articleReference: "Article 286(5)(f)",
    },
    {
      name: "Secretary to Cabinet",
      description: "Secretary to the Cabinet",
      articleReference: "Article 286(5)(g)",
    },
    {
      name: "Head of Ministry or Government Department",
      description: "Head of a Ministry or government department or equivalent office",
      articleReference: "Article 286(5)(h)",
    },
    {
      name: "Chairmen and Members of Boards",
      description: "Chairman and Members of Boards of Directors of public corporations and state enterprises",
      articleReference: "Article 286(5)(i)",
    },
    {
      name: "Managing Directors of Public Corporations",
      description: "Managing Directors of Public Corporations and their Deputies",
      articleReference: "Article 286(5)(j)",
    },
    {
      name: "Members of Professional Regulatory Bodies",
      description: "Members of professional or regulatory bodies set up by law",
      articleReference: "Article 286(5)(k)",
    },
    {
      name: "Police and Security Services Officers",
      description: "Officers in the Police Service, Immigration and Prisons Service, and other security services",
      articleReference: "Article 286(5)(l)",
    },
    {
      name: "Officers in the Armed Forces",
      description: "Officers in the Armed Forces of Ghana",
      articleReference: "Article 286(5)(m)",
    },
    {
      name: "Heads of Public Educational Institutions",
      description: "Heads of public educational institutions",
      articleReference: "Article 286(5)(n)",
    },
    {
      name: "Other Public Officers",
      description: "Such other public officers as Parliament may prescribe by law",
      articleReference: "Article 286(5)(o)",
    },
  ];

  for (const category of categories) {
    await prisma.publicOfficeCategory.upsert({
      where: { id: categories.indexOf(category) + 1 },
      update: category,
      create: category,
    });
  }
  console.log(`✅ Created ${categories.length} public office categories`);

  // Seed Sample Institutions
  console.log("Creating sample institutions...");
  const institutions = [
    { name: "Office of the President", type: "Executive" },
    { name: "Parliament of Ghana", type: "Legislature" },
    { name: "Supreme Court of Ghana", type: "Judiciary" },
    { name: "Ghana Revenue Authority", type: "Agency" },
    { name: "Bank of Ghana", type: "Financial Institution" },
    { name: "Ghana Education Service", type: "Service" },
    { name: "Ghana Health Service", type: "Service" },
    { name: "Ghana Police Service", type: "Security" },
    { name: "Ghana Immigration Service", type: "Security" },
    { name: "Ghana Prisons Service", type: "Security" },
    { name: "Ghana Armed Forces", type: "Military" },
    { name: "University of Ghana", type: "Education" },
    { name: "Kwame Nkrumah University of Science and Technology", type: "Education" },
    { name: "Ghana National Petroleum Corporation", type: "State Enterprise" },
    { name: "Electricity Company of Ghana", type: "State Enterprise" },
  ];

  for (const institution of institutions) {
    await prisma.institution.create({
      data: institution,
    });
  }
  console.log(`✅ Created ${institutions.length} institutions`);

  // Seed Data Retention Policies
  console.log("Creating data retention policies...");
  const retentionPolicies = [
    {
      entityType: "audit_logs",
      retentionPeriodDays: 2555, // 7 years
      archiveAfterDays: 365,
      deleteAfterDays: 2920, // 8 years
    },
    {
      entityType: "declarations",
      retentionPeriodDays: 3650, // 10 years
      archiveAfterDays: 1825, // 5 years
      deleteAfterDays: null,
    },
    {
      entityType: "notifications",
      retentionPeriodDays: 365,
      archiveAfterDays: 180,
      deleteAfterDays: 730,
    },
    {
      entityType: "refresh_tokens",
      retentionPeriodDays: 30,
      archiveAfterDays: null,
      deleteAfterDays: 60,
    },
  ];

  for (const policy of retentionPolicies) {
    await prisma.dataRetentionPolicy.create({
      data: policy,
    });
  }
  console.log(`✅ Created ${retentionPolicies.length} data retention policies`);

  // Create default users for testing (non-production only)
  if (process.env.NODE_ENV === "production") {
    console.log("⏭️  Skipping test user creation in production environment");
  } else {
    console.log("Creating default users...");
    const defaultPassword = await bcrypt.hash("password123", 12);

    const [adminRole, officerRole, legalRole, applicantRole] = await Promise.all([
      prisma.role.findUnique({ where: { name: "admin" } }),
      prisma.role.findUnique({ where: { name: "schedule_officer" } }),
      prisma.role.findUnique({ where: { name: "legal_unit" } }),
      prisma.role.findUnique({ where: { name: "applicant" } }),
    ]);

    const seedUsers = [
      {
        email: "applicant@adla.gov.gh",
        phone: "+233200000005",
        role: applicantRole,
        label: "applicant",
      },
      {
        email: "admin@adla.gov.gh",
        phone: "+233200000000",
        role: adminRole,
        label: "admin",
      },
      {
        email: "officer@adla.gov.gh",
        phone: "+233200000001",
        role: officerRole,
        label: "schedule officer",
      },
      {
        email: "officer2@adla.gov.gh",
        phone: "+233200000002",
        role: officerRole,
        label: "schedule officer 2",
      },
      {
        email: "legal@adla.gov.gh",
        phone: "+233200000003",
        role: legalRole,
        label: "legal unit",
      },
      {
        email: "legal2@adla.gov.gh",
        phone: "+233200000004",
        role: legalRole,
        label: "legal unit 2",
      },
    ];

    for (const { email, phone, role, label } of seedUsers) {
      if (!role) {
        console.warn(`⚠️  Skipping ${label}: role not found`);
        continue;
      }

      const user = await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
          email,
          passwordHash: defaultPassword,
          phone,
          emailVerified: true,
          roles: {
            create: { roleId: role.id },
          },
        },
      });

      await prisma.notificationPreference.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          emailEnabled: true,
          smsEnabled: true,
          inAppEnabled: true,
        },
      });

      console.log(`✅ Created ${label} user: ${email} (password: password123)`);
    }

    const applicantUser = await prisma.user.findUnique({
      where: { email: "applicant@adla.gov.gh" },
    });

    if (applicantUser) {
      const firstInstitution = await prisma.institution.findFirst();
      const firstCategory = await prisma.publicOfficeCategory.findFirst();

      if (firstInstitution && firstCategory) {
        await prisma.applicantProfile.upsert({
          where: { userId: applicantUser.id },
          update: {},
          create: {
            userId: applicantUser.id,
            fullName: "Kwame Asante",
            ghanaCardNumber: "GHA-000000001-0",
            ghanaCardFrontUrl: "https://placeholder.local/ghana-card-front.jpg",
            designation: "Director of Finance",
            institutionId: firstInstitution.id,
            officeCategoryId: firstCategory.id,
            verificationStatus: "VERIFIED",
          },
        });
        console.log("✅ Created applicant profile for applicant@adla.gov.gh");
      }
    }
  }

  console.log("\n🎉 Database seed completed successfully!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seed error:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
