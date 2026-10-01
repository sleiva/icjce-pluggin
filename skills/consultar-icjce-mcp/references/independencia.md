# Independencia e incompatibilidades — dónde está cada cosa

Cubre si el auditor puede aceptar o mantener el encargo y qué servicios puede prestar al
cliente de auditoría: incompatibilidades, amenazas y salvaguardas, honorarios y dependencia
económica, rotación y enfriamiento, vínculos personales y financieros, prohibiciones
posteriores, la comisión de auditoría y la auditoría de grupos.

El punto de partida aquí **no es una búsqueda**: es el mapa de independencia del ICJCE, que ya
dice qué normativa y qué doctrina aplican a cada tema. Se consulta siempre primero, aunque el
usuario aporte una consulta del ICAC: el mapa trae las consultas relacionadas y después se lee
la suya.

## Los tres regímenes

La misma situación no se resuelve igual según a quién se audite. Cada tema del mapa lleva sus
referencias separadas por régimen, y se aplica el que corresponda:

| Régimen | Cuándo se aplica |
|---|---|
| **General** (`regimen='no_eip'`) | A toda auditoría de cuentas, obligatoria **o voluntaria**. Es el suelo común. |
| **Entidades de interés público** (`regimen='eip'`) | Se **suma** al general cuando la entidad auditada es de interés público según la definición de la ley de auditoría y su reglamento (no solo cotizadas, entidades de crédito y aseguradoras; compruébalo con `indice_norma`). |
| **Auditoría de grupos** (`regimen='grupos'`) | Cuando hay auditores de componentes: la independencia se evalúa también respecto de ellos. |

El régimen de entidad de interés público no se añade en bloque: se resuelve por materia, para
que una pregunta sobre honorarios no arrastre las obligaciones de rotación.

## Los temas del mapa

`mapa_independencia` sin `tema` los lista todos. Pídelo por el título del tema:

| Régimen | Temas |
|---|---|
| General | principio general · participar en la gestión o en la toma de decisiones · conflictos de intereses · identificación de amenazas y medidas de salvaguarda · causas de incompatibilidad y sus extensiones · situaciones personales (cargos, intereses significativos, instrumentos) · servicios prestados distintos de la auditoría · periodo de vigencia de las incompatibilidades · prohibiciones posteriores a la finalización del encargo · honorarios y dependencia económica |
| Entidades de interés público | honorarios: régimen adicional · prestación de servicios: régimen adicional · rotación y enfriamiento · situaciones personales y sus extensiones · obligaciones y actuaciones ante la comisión de auditoría · principio general · amenazas y salvaguardas · periodo de vigencia · prohibiciones posteriores |
| Grupos | independencia en la auditoría de grupos |

## Los datos que cambian la respuesta

| Dato | Por qué cambia la respuesta |
|---|---|
| **Si la entidad es de interés público** | Se **añaden** al régimen general: la lista de servicios prohibidos del Reglamento europeo, el límite a los honorarios por servicios distintos de la auditoría, la rotación obligatoria y las obligaciones ante la comisión de auditoría. El régimen general **ya tiene** sus propias incompatibilidades por servicios prestados (contabilidad, ciertas valoraciones, auditoría interna, abogacía, diseño de control interno…): una respuesta de no EIP no puede decir que «no hay servicios prohibidos». |
| **Si la auditoría es obligatoria o voluntaria** | El régimen general cubre también la voluntaria, pero cambian las consecuencias y algunas obligaciones. |
| **Quién tiene el vínculo o el interés** | No es lo mismo el socio firmante, otro miembro del equipo, otro miembro de la firma o un familiar: cambia la extensión de la causa de incompatibilidad. |
| **Cuándo ocurre** | Durante el encargo, antes de aceptarlo o después de terminarlo: las prohibiciones posteriores y el periodo de vigencia son distintos. |
| **La naturaleza del servicio** | Hay que ver si es distinto de la auditoría y si la entidad es de interés público: el mismo servicio puede ser admisible en un régimen y prohibido en el otro. |
| **Si el usuario ya aporta una consulta del ICAC del caso** | Se lee, pero **después** del mapa: el mapa dice qué más aplica. |

## Con qué tools

| Para… | Tool |
|---|---|
| El mapa del tema y el régimen: artículos de la ley, el reglamento y el Reglamento europeo, consultas del ICAC, criterios del Grupo de Trabajo de Independencia, guías, modelos, ejemplos y sentencias | `mapa_independencia` con `tema` y `regimen` |
| El texto del artículo que el mapa señala | `leer_articulo` con el `block_id` |
| La consulta del ICAC, la guía, el criterio, el modelo de confirmación o la sentencia | `leer_documento` con el `doc_id` que da el mapa |
| El modelo de confirmación de independencia o las instrucciones de grupos | `buscar_modelos_informe` |
| Una situación que el mapa no cubre | `buscar_documentos` con `grupo='independencia'` y después `leer_documento` |

## Errores típicos de esta área

| Error | Corrección |
|---|---|
| Contestar «de memoria» el régimen de una incompatibilidad | El mapa dice qué normas y qué doctrina mirar; se leen, se contrastan con los hechos del caso y se citan |
| Buscar en las consultas antes de mirar el mapa | El mapa primero: trae las consultas que aplican |
| Dar por prohibido o por permitido un servicio sin comprobar el régimen | La misma situación cambia entre el régimen general y el de entidad de interés público |
| Aplicar el régimen de interés público a una auditoría voluntaria | El régimen general cubre la auditoría voluntaria |
