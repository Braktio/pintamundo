# Pintamundo en Google Play

Material para la ficha de Play Console. Las imágenes se regeneran con `node scripts/store-shots.mjs "ruta/a/chrome.exe"`.

| Archivo | Uso en Play Console | Tamaño |
| --- | --- | --- |
| `icon-512.png` | Icono de la aplicación | 512 × 512 |
| `feature-graphic.png` | Gráfico de funciones | 1024 × 500 |
| `01-inicio.png` … `06-misiones.png` | Capturas de pantalla del teléfono (horizontal) | 1920 × 1080 |

El archivo que se sube es **`pintamundo.aab`**, de la versión fija «apk» de GitHub Releases. Lo genera GitHub Actions en cada cambio.

## Detalles de la app

- **Nombre:** Pintamundo
- **Descripción breve** (máx. 80 caracteres):
  > ¡Pinta el mapa, atrapa rivales y sube de rango en partidas en línea!
- **Descripción completa:**

> ¡Pinta el mundo de tu color! 🎨
>
> En Pintamundo sales de tu zona, dibujas un camino y vuelves a casa: todo lo que encierres se pinta de tu color. Pero cuidado: si un rival toca tu camino mientras estás fuera, ¡te atrapa! Y si tú tocas el suyo, te quedas con parte de su zona.
>
> 🌍 MULTIJUGADOR EN LÍNEA
> Juega partidas rápidas contra jugadores de todo el mundo o crea una sala, comparte el código con tus amigos y competid juntos. Si faltan jugadores, los robots ocupan su lugar.
>
> 🏆 RANGOS Y TEMPORADAS
> Gana copas en las partidas en línea y sube de Bronce 1 a Leyenda 3. Cada mes hay una temporada nueva con cofres de premio según tu rango, un ranking mundial y un ranking de amigos.
>
> 🐥 37 PERSONAJES CON PODERES
> Desbloquea personajes comunes, raros, épicos, legendarios y míticos. Cada uno trae sus poderes: Turbo, Burbuja, Imán, Disparo, Rodillo, Bomba de color, Congelar… Los repetidos suben su nivel y amplían el alcance de sus poderes.
>
> 🎁 COFRES, MISIONES Y RACHA DIARIA
> Abre cofres, completa tres misiones nuevas cada día y mantén tu racha para ganar premios cada vez mejores.
>
> 🕹️ CONTROLES SENCILLOS
> Toca cualquier parte de la pantalla y desliza el dedo hacia donde quieras ir. Siempre en horizontal, con dos pulgares.
>
> ☁️ TU PROGRESO, SEGURO
> Conecta tu cuenta de Google para guardar tu progreso en la nube y seguir jugando en otro teléfono.
>
> Pintamundo es gratis. Incluye anuncios opcionales: solo ves uno si eliges hacerlo a cambio de una recompensa.

- **Categoría:** Juegos → Casual (o Arcade)
- **Correo de contacto:** el de tu cuenta de desarrollador
- **Política de privacidad:** https://braktio.github.io/pintamundo/privacy.html

## Contenido de la app (formularios)

**Acceso a la app:** todas las funciones están disponibles sin acceso especial (la cuenta de Google es opcional).

**Anuncios:** Sí, la app contiene anuncios (anuncios con recompensa de AdMob), **solo para jugadores de 13 años o más**. Para los menores de 13 (o si no indicaron su edad) AdMob ni siquiera se inicia.

**Clasificación de contenido (cuestionario IARC):**
- Categoría: Juego.
- Violencia: no hay violencia realista; los personajes «atrapan» a los rivales tocando su camino, sin sangre ni daño. Responde «No» a violencia, o como mucho «violencia de fantasía leve, de dibujos animados».
- Miedo, sexo, lenguaje soez, drogas y apuestas: No. Los cofres se abren con estrellas del juego, no con dinero real.
- Interacción entre usuarios: Sí (partidas en línea). No hay chat, solo nombres elegidos por el jugador y emotes fijos.
- Comparte la ubicación del usuario: No.
- Compras digitales: No (por ahora).

**Público objetivo y contenido:** marca **9–12, 13–15, 16–17 y 18 o más** (el juego es para 10 años o más). Al incluir menores de 13, la app queda bajo la **Política de Familias** de Google Play como público **mixto**, y el juego ya cumple lo que exige:

- **Pantalla de edad neutral** al abrir el juego por primera vez («¿En qué año naciste?», sin año preseleccionado ni pistas). Solo se guarda si es menor de 13 o no, nunca el año.
- **Menores de 13 (o edad desconocida):** sin anuncios ni AdMob (no se envía el ID de publicidad), sin inicio de sesión con Google y sin escribir nombre: en línea aparecen con el nombre de su personaje.
- **13 años o más:** anuncios con recompensa de AdMob (SDK autocertificado para Familias), clasificación máxima de anuncios PG, y cuenta de Google opcional.
- Sin chat: solo emotes de una lista fija.

En el formulario de Familias responde que los anuncios a niños **no se muestran** y que usas una pantalla de edad neutral. En la ficha no prometas nada que sea solo para mayores (por ejemplo, el ranking con cuenta) como si fuera para todos.

**Seguridad de los datos:**
- ¿Recoge o comparte datos? **Sí.**
- ¿Los datos se cifran en tránsito? **Sí** (HTTPS y WSS).
- ¿Los usuarios pueden pedir que se borren? **Sí.** Enlace: https://braktio.github.io/pintamundo/privacy.html#borrar

| Tipo de dato | Recogido | Compartido | Para qué | ¿Opcional? |
| --- | --- | --- | --- | --- |
| Información personal → Nombre (el apodo del juego, solo 13+) | Sí | No | Funcionalidad de la app | Sí (solo se envía en partidas en línea o con cuenta) |
| Información personal → ID de usuario (Firebase) | Sí | No | Funcionalidad de la app, gestión de la cuenta | Sí (solo con cuenta) |
| Actividad en la app → Otras acciones (progreso del juego) | Sí | No | Funcionalidad de la app | Sí (solo con cuenta) |
| Identificadores del dispositivo → ID de publicidad (solo 13+) | Sí | Sí (Google AdMob) | Publicidad, prevención de fraude | No |
| Información de la app y rendimiento → Diagnósticos | Sí | Sí (Google AdMob) | Publicidad, análisis | No |
| Ubicación aproximada (por IP, AdMob) | Sí | Sí (Google AdMob) | Publicidad | No |

**Eliminación de la cuenta:** dentro de la app, en Progreso → ☁️ Cuenta de Google → «Borrar mis datos de la nube». En la web: https://braktio.github.io/pintamundo/privacy.html#borrar

**Apps gubernamentales, financieras, de salud o de noticias:** No.

## Firma de la app y Firebase

Google Play vuelve a firmar la app con su propia clave (Firma de apps de Play). El inicio de sesión con Google solo funciona si Firebase conoce también **esa** huella. Después de subir el primer AAB:

1. En Play Console: **Prueba y lanzamiento → Configuración → Integridad de la app → Firma de apps**. Copia el **SHA-1** y el **SHA-256** de la «Clave de firma de apps».
2. En Firebase: **Configuración del proyecto → Tus apps → com.braktio.pintamundo → Agregar huella digital**. Pega las dos.
3. Descarga de nuevo `google-services.json`, cámbialo en `android/app/` y sube el cambio.

La clave de subida es la de `firma-android/pintamundo.keystore` (SHA-1 `54:DF:4C:CE:10:D2:38:D2:22:1B:A1:D4:07:92:73:2E:1F:E6:CA:92`). Guárdala bien: sin ella no se pueden subir actualizaciones.

## Primera publicación con una cuenta personal

Las cuentas personales nuevas deben hacer una **prueba cerrada con al menos 12 testers durante 14 días seguidos** antes de poder solicitar el acceso a producción:

1. **Prueba y lanzamiento → Pruebas → Prueba cerrada → Crear canal**, sube `pintamundo.aab` y añade una lista de correos de testers (cuentas de Google).
2. Comparte con ellos el enlace de participación: deben aceptarlo e instalar la app desde Google Play, y conviene que la abran varios días.
3. Pasados 14 días con 12 o más testers activos, en el **Panel** aparece **Solicitar acceso a producción**. Google pregunta cómo fue la prueba; responde con detalle.
4. Cada actualización durante la prueba: sube el nuevo `pintamundo.aab` al mismo canal (el código de versión sube solo en GitHub Actions).
