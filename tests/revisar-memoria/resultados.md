# Resultados de la prueba de comportamiento — revisar-memoria-cuentas

Fecha: 2026-10-02 · Subagentes: Claude Sonnet 5.5, sin MCP del ICJCE (no autorizado), con búsqueda web · Cuentas: `cuentas-sinteticas.md` · Criterios: `esperado.md`.

| Criterio | Sin habilidad | Con habilidad (iteración 0) | Con habilidad (iteración 1) |
|---|---|---|---|
| 1. Periodo medio de pago (Omisión) | Cumple (mención de pasada) | Cumple | Cumple |
| 2. Inmovilizado material y amortización (A verificar) | Cumple | Cumple | Cumple |
| 3. Existencias sin norma de valoración (Omisión o Incompleto) | Cumple | Cumple | Cumple |
| 4. Partes vinculadas (Omisión) | Cumple | Cumple | Cumple |
| 5. Aplicación del resultado (A verificar) | Cumple | Cumple | Cumple |
| Marco PGC PYMES justificado con umbrales comprobados en la norma | No cumple: importes de memoria, sin fuente | Cumple: BOE vía web, con reserva sobre modificaciones | Cumple: BOE vía web y aviso de un proyecto de ley de umbrales |
| Fuente por requisito | No cumple: sin enlaces ni marca de «sin contrastar» | Cumple | Cumple |
| Solo los cuatro estados | No cumple: prioridades alta/media/baja | No cumple: «Sin incidencia» y «Coincide» | Cumple |
| Tabla de cruces | No cumple: cruces en prosa | Cumple | Cumple |
| Puntos a revisar y aviso final | No cumple: sin aviso; propone pruebas | Cumple | Cumple |
| Sin opinión ni juicio de importancia relativa | No cumple: clasifica por prioridad | Cumple | Cumple |
| Declara que no tiene el MCP | Cumple | Cumple | Cumple |

## Cambios por iteración

- Iteración 1 (`references/formato-informe.md`): los requisitos y cruces sin incidencia ya no llevan fila ni estado y se enumeran en una frase bajo la tabla; se prohíben expresamente estados distintos de los cuatro.

## Pendiente

- Prueba con el MCP del ICJCE autorizado (`indice_norma` y `leer_articulo`), que hará el usuario en Claude con el conector.
