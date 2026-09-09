# QA Data Discovery Report

Generated from the shared Google Drive corpus. Metrics at cell level were **not** invented: Drive listed files but binary download required a Google session.

## Source folders

| Folder | URL |
| --- | --- |
| ESTADISTICAS LUIS FERNANDO PACHECO | https://drive.google.com/drive/folders/1JfPBrZ50J-8it8zH9Qhp3Cq6a76DdbTP |
| pruebas qa | https://drive.google.com/drive/folders/1hCe3QBPraJEvt6H60KcCOiNIFzG6zdL- |

The original prompt folder ID had a case typo (`kCC` vs `KcC`).

## File types

- `.xlsx` — primary structured source (`Matriz_QA_*`, `Ejecucion_QA_*`, RTM)
- `.docx` — evidence packs and weekly/narrative reports
- `.pdf` — weekly process report (20–24 Jul 2026)
- Playwright suite — `.spec.ts`, `playwright-report/index.html`, `test-results/`

## Projects identified (do not invent others)

| Project | Evidence | Status |
| --- | --- | --- |
| SUMIMEDICAL | folder + matrices + `test-Sumi` | ACTIVE |
| MEDICINA INTEGRAL | folder + matrices + `test-medicina-Integral` | ACTIVE |
| FERROCARRILES | weekly PDF + `test-ferro` | ACTIVE |
| SANOVA | Playwright folder `test-sanova` only | REQUIRES_REVIEW |
| HORUS Health | product name on impression matrix / evidence | product, not a separate client |

**Not found in this QA corpus:** FOMAG, Libre Elección, Autorizaciones. Do not seed them.

## Modules identified from filenames

Impresión de órdenes / reglas de líneas telefónicas; número de documentos (valores límite); contrato ventas; creación de agenda; guardado de historias clínicas; escalas clínicas (PHQ, STOP-BANG, GERDQ); escalas respiratorias; prestadores/sedes; atención particular; curación de heridas domicilio; devolución RIPS; SRQ-30; historia clínica VIH; mesa de ayuda; notificación de sucesos de seguridad; novedades fecha registro; valoración preanestésica; anestesiología; validación de módulos Horus-M.I.

## Test types

Functional matrices, Playwright E2E, RTM, boundary (valores límite), verification evidence, weekly report.

## Dates

Visible range: **20 Jul 2026 – 7 Sep 2026**.

## Environments

- DEV — `Evidencias del Guardado De Las Historias en DEV.docx`
- PROD — `Desarrollos_Produccion_05/08/2026`
- QA / STAGING — Unknown until parse

## Responsible

Luis Fernando Pacheco (folder + weekly PDF filename). Others: Unknown.

## Results, defects, versions, commits

Unknown until Import Center parses the binaries. Empty dashboard is correct; fake PASS/FAIL is not.

## Duplicate risks

- `Ejecucion_QA_REGLAS_LINEAS_TELEFONICAS.xlsx` vs `Copia de Ejecucion_QA_...`
- Matriz HORUS Impresión vs RTM impresión vs evidence DOCX
- Weekly PDF + weekly DOCX + matrices for the same period
- Playwright specs vs Excel matrices for the same module

Fingerprint: `project + module + normalized title + execution date + version` plus source file hash.

## Missing

Cell-level PASS/FAIL counts, defect severity/status, commits, coverage vs backlog. Uncertain fields must stay `Unknown` or `Requires review`. Conflicting reports become `DataConflict` rows, not silent averages.
