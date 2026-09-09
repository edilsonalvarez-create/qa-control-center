import { PrismaClient, ProjectStatus, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Catalog-only seed from Drive discovery.
 * No invented PASS/FAIL metrics.
 */
const PROJECTS = [
  {
    name: "SUMIMEDICAL",
    client: "SUMIMEDICAL",
    product: "HORUS Health",
    status: ProjectStatus.ACTIVE,
    description: "Identified from Drive folder SUMIMEDICAL, matrices and Playwright test-Sumi.",
    modules: [
      "Impresión de órdenes / reglas de líneas telefónicas",
      "Contrato ventas",
      "Creación de agenda",
      "Guardado de historias clínicas",
      "Escalas",
      "Actualización prestadores y sedes",
      "Atención particular",
      "Criterios de aceptación de instrumento",
      "Curación de heridas domicilio",
      "Devolución RIPS / errores preload",
      "Escala SRQ-30",
      "Historia clínica VIH",
      "Mesa de ayuda",
      "Notificación de sucesos de seguridad",
      "Novedades fecha de registro",
      "Valoración preanestésica",
      "Anestesiología",
    ],
  },
  {
    name: "MEDICINA INTEGRAL",
    client: "MEDICINA INTEGRAL",
    product: "HORUS Health",
    status: ProjectStatus.ACTIVE,
    description: "Identified from Drive folder MEDICINA INTEGRAL and Playwright test-medicina-Integral.",
    modules: [
      "Escalas clínicas PHQ / STOP-BANG / GERDQ",
      "Escalas respiratorias",
      "Validación de módulos Horus-M.I.",
    ],
  },
  {
    name: "FERROCARRILES",
    client: "FERROCARRILES",
    product: "HORUS Health",
    status: ProjectStatus.ACTIVE,
    description: "Identified from weekly PDF filename and Playwright folder test-ferro.",
    modules: [],
  },
  {
    name: "SANOVA",
    client: "SANOVA",
    product: "Unknown",
    status: ProjectStatus.REQUIRES_REVIEW,
    description: "Only evidence is Playwright folder test-sanova. Requires review.",
    modules: [],
  },
] as const;

const SOURCE_FILES = [
  {
    project: "SUMIMEDICAL",
    fileName: "Ejecucion_QA_REGLAS_LINEAS_TELEFONICAS.xlsx",
    sourceUrl:
      "https://drive.google.com/drive/folders/11_78y3cJz-ecKJM6PBfrN9oMWGwKsh6P",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
  {
    project: "SUMIMEDICAL",
    fileName: "Copia de Ejecucion_QA_REGLAS_LINEAS_TELEFONICAS.xlsx",
    sourceUrl:
      "https://drive.google.com/drive/folders/1g76iV12wqfFToUyzKbexzQHYT22SRmpF",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
  {
    project: "SUMIMEDICAL",
    fileName: "Matriz_QA_HORUS_Health_Impresion.xlsx",
    sourceUrl:
      "https://drive.google.com/drive/folders/1kRL0plc0-eodo80WqWR68g0FcRKtmyBr",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
  {
    project: "SUMIMEDICAL",
    fileName: "Informe_Semanal_QA_Desarrollo (1).docx",
    sourceUrl:
      "https://drive.google.com/drive/folders/1um4tn1UV7bQujQDGLldblRPFGHUw3I_u",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  {
    project: "FERROCARRILES",
    fileName:
      "informe_proceso_medicina_integral,_sumimedical,_ferrocarriles_luis_fernando_pacheco_pacheco_2026-07-20_2026-07-24.pdf",
    sourceUrl: "https://drive.google.com/file/d/1tL9WxangukUMVTUpILHVO8FKNH1dmf0-/view",
    sourceFileId: "1tL9WxangukUMVTUpILHVO8FKNH1dmf0-",
    mimeType: "application/pdf",
  },
  {
    project: "MEDICINA INTEGRAL",
    fileName: "Validacion_Modulos_Horus-M.I.xlsx",
    sourceUrl:
      "https://drive.google.com/drive/folders/1AfmkSCwZDeZl3UBd_sonImrswAoDGtLo",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
];

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@qacc.local";
  const password = process.env.ADMIN_PASSWORD ?? "ChangeMeNow!";
  const name = process.env.ADMIN_NAME ?? "QA Admin";
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: { name, role: Role.ADMIN, active: true },
    create: { email, name, passwordHash, role: Role.ADMIN },
  });

  const viewerEmail = "viewer@qacc.local";
  await prisma.user.upsert({
    where: { email: viewerEmail },
    update: {},
    create: {
      email: viewerEmail,
      name: "Viewer",
      passwordHash: await bcrypt.hash("ViewerPass1!", 12),
      role: Role.VIEWER,
    },
  });

  const qaEmail = "qa@qacc.local";
  await prisma.user.upsert({
    where: { email: qaEmail },
    update: {},
    create: {
      email: qaEmail,
      name: "QA Analyst",
      passwordHash: await bcrypt.hash("QaPass1!", 12),
      role: Role.QA,
    },
  });

  for (const p of PROJECTS) {
    const project = await prisma.project.upsert({
      where: { name: p.name },
      update: {
        description: p.description,
        client: p.client,
        product: p.product,
        status: p.status,
      },
      create: {
        name: p.name,
        description: p.description,
        client: p.client,
        product: p.product,
        status: p.status,
      },
    });
    for (const moduleName of p.modules) {
      await prisma.module.upsert({
        where: { projectId_name: { projectId: project.id, name: moduleName } },
        update: {},
        create: { projectId: project.id, name: moduleName },
      });
    }
  }

  for (const f of SOURCE_FILES) {
    const project = await prisma.project.findUnique({ where: { name: f.project } });
    const existing = await prisma.sourceFile.findFirst({
      where: { fileName: f.fileName, projectId: project?.id ?? null },
    });
    if (!existing) {
      await prisma.sourceFile.create({
        data: {
          projectId: project?.id,
          fileName: f.fileName,
          mimeType: f.mimeType,
          sourceUrl: f.sourceUrl,
          sourceFileId: "sourceFileId" in f ? f.sourceFileId : undefined,
        },
      });
    }
  }

  console.log("Seed complete: catalog only (no invented test metrics).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
