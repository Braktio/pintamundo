# Pintamundo · ¡Pinta el mundo de tu color!

Estética de dibujos animados (antes *Neon Frontier*) para todas las edades: tablero claro, colores de caramelo, personajes con cara, textos sencillos, botones grandes, sonidos de dibujos animados y modo fácil. Las reglas del juego son las mismas.

Juego de conquista territorial para smartphones en **horizontal**, con Canvas 2D y JavaScript modular. La cámara es cenital ortográfica a 90°: no tiene inclinación, perspectiva, escalas distintas por eje ni retraso al seguir al piloto. El jugador permanece en el centro exacto del canvas.

## Ejecutar y abrir en el teléfono

Abre la carpeta en VS Code y ejecuta, con Node.js 18 o superior:

```powershell
node server.mjs
```

En el PC visita **http://localhost:5173**. En el teléfono, conectado a la misma red Wi-Fi, abre la dirección **En tu móvil** que imprime la terminal. El servidor escucha la red local; puedes limitarlo al PC con `$env:HOST='127.0.0.1'`. No necesitas instalar paquetes ni compilar.

También puedes abrir `index.html` con **Live Server** y usar la IP local y su puerto desde el teléfono. Los módulos JavaScript requieren HTTP; `file://` no funciona.

## Control móvil

- Toda la pantalla es un **joystick invisible**: el punto donde apoyas el dedo es el centro y el personaje va hacia donde lo deslizas. Si el dedo se aleja más de 70 px, el centro lo sigue, así que dar la vuelta no exige un recorrido largo. Avanza solo y mantiene el rumbo al soltar.
- El giro está limitado a **0,1 radianes por fotograma a 60 Hz**, equivalente a 6 rad/s. Se integra con un paso fijo de 90 Hz para conservar la misma velocidad angular entre dispositivos.
- Los dos botones derechos activan las habilidades. Admiten un segundo dedo mientras diriges con el primero.
- **Ⅱ** pausa. Cambiar de pestaña también pausa.
- **Siempre en horizontal.** La APK está fijada en horizontal en su manifiesto, y Android lo respeta aunque la rotación automática esté apagada. En un navegador con el teléfono en vertical (Safari no deja bloquear la orientación), `orient()` de `game.js` gira todo el juego 90° y adapta las media queries y las unidades `vw`/`vh` (`--vw`, `--vh`). Nunca se pide girar el teléfono.
- Sin aviso de «vuelve a casa»: el peligro se ve en la propia estela.
- **⛶** solicita pantalla completa y bloqueo horizontal cuando el navegador lo permite. Safari en iPhone no lo admite: el botón explica cómo usar **Compartir → Añadir a pantalla de inicio**. Abierto desde ese icono (`manifest.webmanifest`, iconos en `icons/`), el juego ocupa toda la pantalla y el botón se oculta.
- El teclado y el mouse se conservan como ayudas de desarrollo al probar en el PC; la interfaz de juego está diseñada para tocarse.

## Reglas estrictas

1. **Nunca mueres al atravesar tu propia estela.** Puedes cruzarla, recorrerla y cerrar figuras con intersecciones. Las estelas superpuestas conservan sus dueños mediante máscaras de bits.
2. **El contacto entre motos no produce daño.** Los cuerpos se atraviesan; el corto tramo de estela situado bajo una moto superpuesta se trata como contacto de cuerpo.
3. **Solo un corte de estela enemiga elimina un piloto.** La punta de la moto recorre las celdas cruzadas mediante DDA. Al interceptar una estela rival expuesta, se elimina a su dueño; el atacante sobrevive. El cuerpo de la moto no ejecuta cortes.
4. La víctima emite **35 partículas** de su color. Su estela se ve rota por el punto del corte y se desvanece, pero deja de participar en las colisiones inmediatamente. Los pilotos eliminados no reaparecen durante esa partida.
5. **Los bordes no matan.** La posición queda dentro de la arena y el rumbo gira suavemente para deslizarse sobre el límite.
6. A menos de **40 píxeles visibles del borde**, se activa **Wall Surge**: velocidad ×1,35, chispas eléctricas contra el muro e indicador **WALL BOOST**. Se desactiva al alejarse. El rango se ajusta a la escala ortográfica de pantalla.

## Conquista y combate

La red tiene 84 × 72 celdas. Siete pilotos comienzan con bases separadas. Salir del territorio deja una estela; regresar cierra el trazado y conquista el área encerrada. Un flood fill desde los bordes distingue el interior del exterior. Las diagonales se conectan mediante DDA, evitando fugas geométricas.

Hay seis bots con rutas de expansión y caza de estelas. Respetan escudos y la invisibilidad de Corte Rápido. Una baja transfiere al atacante el 25% del territorio rival, redondeado hacia abajo; el resto queda neutral. En solitario, pintar **más del 50%** ya es una victoria (cofre épico), pero la partida sigue hasta pintar el **100%** o hasta que te atrapen. Cuando atrapas a todos los robots, a los 2,5 s aparecen hasta 3 nuevos en zonas sin pintar y lejos de ti; si no queda sitio libre, no vuelve nadie. En línea, más del 50% termina la partida.

## Personajes, rareza y poderes

Hay 37 personajes dibujados por código (`CHARACTERS` en `engine.js`): 12 comunes, 9 raros, 7 épicos, 5 legendarios y 4 míticos. Los poderes son del personaje, no del nivel:

| Rareza | Poderes | Recarga |
| --- | --- | --- |
| Común | Ninguno | — |
| Raro | 1 básico (Turbo, Burbuja o Imán) | ×1 |
| Épico | 1 fuerte (Disparo, Fantasma o Rodillo) | ×0,95 |
| Legendario | 2 | ×0,9 |
| Mítico | 2, incluida Bomba o Congelar | ×0,85 |

Valores con el personaje en nivel 1. Cada nivel de personaje aumenta un 4 % el alcance o la duración (+36 % en el nivel 10). Los poderes empiezan cada partida **a media carga** (`START_CHARGE`), así que nadie puede usarlos en el primer segundo.

| Poder | Duración | Recarga base | Efecto |
| --- | --- | --- | --- |
| 🚀 Turbo | 3 s | 16 s | Velocidad ×1,45 |
| 🛡️ Burbuja | 1,5 s | 20 s | Protege la estela y desvía al atacante |
| 🧲 Imán | 4 s | 18 s | Atrae estrellas a menos de 10 casillas |
| 👻 Fantasma | 3 s | 22 s | Oculta a la IA la mitad reciente de la estela |
| 🎯 Disparo | instantáneo | 18 s | Bola de pintura de unas 11 casillas de alcance: si cruza la estela expuesta de un rival, lo elimina; si toca su cuerpo, lo aturde 0,6 s; donde cae pinta un círculo de radio 1,6. La Burbuja la bloquea |
| 🖌️ Rodillo | 2,5 s | 26 s | Pinta por donde pasas (pincel de radio 1,2) sin dejar estela; si tenías estela expuesta, se cierra |
| 💥 Bomba de color | instantáneo | 32 s | Conquista un círculo de radio 3 alrededor y cierra la estela expuesta |
| ❄️ Congelar | instantáneo | 30 s | Inmoviliza 1,2 s a los rivales a menos de 6 casillas (no a los que tienen Burbuja) |

Los bots también reciben personajes al azar (los raros aparecen menos) y usan sus poderes. En modo fácil solo salen comunes y raros, y nunca disparan ni congelan. Turbo y Wall Surge se combinan: ×1,45 ×1,35 ≈ ×1,96. Recoger una estrella da 2 estrellas, 2 XP y un borde extra de una celda en los cierres durante 10 segundos.

## Niveles de personaje

Los personajes **raros, épicos, legendarios y míticos** suben de nivel, del 1 al 10, con los repetidos que salen en los cofres (`characterLevel` y `copiesFor` en `engine.js`). Para pasar del nivel *n* al *n*+1 hacen falta ⌈*n*/2⌉ repetidos: 25 en total hasta el nivel 10. Cada nivel aumenta un **6 % el alcance** de sus poderes (+54 % en el nivel 10):

- Distancia: alcance del Disparo y de su pintura, radio de la Bomba, de Congelar, del Imán y del pincel del Rodillo.
- Duración, en los poderes sin distancia: Turbo, Burbuja y Fantasma.

Mientras queden premios nuevos en la rareza sorteada, 1 de cada 4 cofres da un repetido de un personaje tuyo que aún pueda subir. Los comunes no suben de nivel; sus repetidos, igual que los de un personaje en el nivel 10 o los de un color, se devuelven en estrellas. Los robots juegan siempre a nivel 1. En línea, el teléfono envía el nivel y el servidor solo acepta valores del 1 al 10. La colección muestra el nivel, los repetidos que faltan y el alcance extra.

La foto de perfil (arriba a la izquierda y en el ranking mundial) es el personaje elegido en ese momento.

## Cofres

| Cofre | Precio | Común | Raro | Épico | Legendario | Mítico |
| --- | --- | --- | --- | --- | --- | --- |
| Común | 1.000 ⭐ | 70% | 25% | 5% | — | — |
| Raro | 3.000 ⭐ | 35% | 45% | 15% | 5% | — |
| Épico | 8.000 ⭐ | — | 35% | 45% | 15% | 5% |
| Legendario | 20.000 ⭐ | — | — | 40% | 45% | 15% |

Los cofres cuestan esfuerzo (`fillChestBar`, `levelChest` y `CHESTS` en `engine.js`):
- **Barra de cofre:** las estrellas de cada partida (0 a 3) la llenan. Cada **12 estrellas** dan un cofre: 75 % común, 22 % raro y 3 % épico. Son unas 5 partidas buenas por cofre.
- **Niveles:** un cofre común cada 2 niveles, raro cada 5 y épico cada 10.
- **Otras fuentes:** el cofre común gratis cada **8 horas**, un cofre común por completar las 3 misiones diarias, la racha (comunes los días 3 y 6, raro el 7) y los premios de temporada.
- **Estrellas:** las partidas dan 6 por cada punto porcentual pintado y 40 por rival atrapado, y cada estrella del mapa da 2.
- **Repetidos:** si el personaje no puede subir de nivel, se devuelve en estrellas (de 20 a 320 según la rareza).

Un perfil nuevo empieza con un cofre raro. Dentro de la rareza sorteada se priorizan los premios nuevos. Las probabilidades se muestran en la pantalla de cofres. No hay compras con dinero real.

**Reinicio del progreso (época):** `PROGRESS_EPOCH` (ahora 2). Un perfil guardado con otra época, en el teléfono o en la nube, empieza de cero conservando el nombre y el modo fácil, y el juego lo explica una vez. El servidor rechaza las partidas en línea de teléfonos con otra época («Actualiza Pintamundo…»). Las filas del ranking llevan la época, y el servidor y la app ignoran las de épocas anteriores. Para volver a reiniciar a todos basta con subir el número.

## HUD y progreso

El HUD de cristal oscuro reproduce la composición de referencia: silueta de moto y nombre **CYBER_HAWK_01** arriba a la izquierda, barra cian al 80% y barra de energía con degradado cian/amarillo. La primera es un indicador visual de escudo, no un sistema de vida por impactos: las reglas siguen siendo de eliminación por corte. Se ilumina al 100% con escudo y cae a 0 al morir. La energía refleja el uso y la recarga de Dash Boost.

La clasificación muestra los tres líderes con nombres de piloto y puntuación entre paréntesis, calculada como `celdas × 20 + bajas × 1000`. El minimapa refleja territorios y estelas. Los controles respetan áreas seguras y tienen superficies táctiles de al menos 44 px.

Cada punto porcentual conquistado entrega 6 estrellas y 10 XP; cada baja, 40 estrellas y 40 XP; cada estrella del mapa, 2 estrellas y 1 XP. Se guarda el progreso al obtenerlo y cada 10 segundos. La partida en curso no se restaura al recargar. El nivel sigue `1 + floor((XP / 300)^(1 / 1.9))`: nivel 2 con 300 XP, 5 con unos 4.200 y 10 con unos 19.500 (unas 2, 22 y 100 partidas normales).

Gato Rayo se regala en el nivel 2, Platillo Zum en el 5 y Dragoncito en el 10 (también pueden salir en cofres). El botón 🐢 del menú activa el **modo fácil**: los robots van más despacio, cazan desde más cerca y tu camino se dibuja más grueso. Los perfiles anteriores se migran solos: el antiguo contador de cofres pasa a cofres raros.

## Rangos, temporadas y ranking mundial

Las **copas 🏆 solo se ganan en partidas en línea con la cuenta de Google conectada**, y las calcula el servidor, así que nadie puede subirse las suyas:

1. Al entrar en una sala, el teléfono envía su token de Firebase (`cloud.idToken`) y el servidor lo verifica (`ranked.mjs`). Un token falso deja la partida sin ranking.
2. Al terminar, la sala calcula para cada jugador verificado las estrellas (`matchStars`, igual que en el teléfono), sus capturas, si pintó todo el mapa y su puesto (`Room.results` en `multiplayer.mjs`).
3. El servidor suma las copas (`rankChange`) en una transacción de Firestore y envía al teléfono un mensaje `trophies` con el cambio y el total.

Para eso necesita la clave de cuenta de servicio de Firebase en la variable de entorno `FIREBASE_SERVICE_ACCOUNT` de Render (declarada en `render.yaml` con `sync: false`). Sin ella, el juego en línea funciona igual pero sin ranking. Las partidas en solitario dan estrellas, cofres y XP, pero no copas.

Cuántas copas da cada partida: −6 sin estrellas; +4, +10 o +18 con 1, 2 o 3 estrellas; +2 por cada rival atrapado (hasta 5); +20 por pintar todo el mapa; +8 al primero, +3 del 2.º al 3.º y −3 al último. Nunca bajan de cero.

**Temporadas:** una por mes natural (UTC), con su propia colección `ranking-AAAA-MM/{uid}` (nombre, copas y personaje). Cada temporada empieza con la mitad de las copas de la anterior (`seasonStart`). La primera, `2026-10`, parte del ranking de antes (`ranking/{uid}`, ahora de solo lectura). Al abrir el juego tras el fin de una temporada, se reciben una vez cofres según el rango alcanzado (`SEASON_REWARDS`: de 1 cofre común en Bronce a 2 legendarios y 1 épico en Leyenda).

**10 rangos con 3 niveles** (30 en total): Bronce, Plata, Oro, Platino, Esmeralda, Rubí, Diamante, Maestro, Gran Maestro y Leyenda, del 1 al 3. Cada nivel empieza en `40·n + 4·n²` copas (Bronce 2 en 44, Plata 1 en 156, Leyenda 3 en 4.524). Los emblemas son escudos SVG con corona a partir de Maestro.

La pestaña **Rangos** tiene tres vistas:
- **Mundial:** los 50 mejores de la temporada.
- **Amigos:** las personas con las que jugaste salas de amigos con cuenta. El servidor las incluye en el mensaje `trophies` y se guardan en el perfil, hasta 50.
- **Rangos:** la escalera completa.

Las reglas de `firestore.rules` permiten leer el ranking a cualquiera, pero no escribirlo: solo el servidor escribe, con la clave de administrador. Cada jugador puede borrar sus propias filas.

## Niveles de personaje

Los personajes **raros, épicos, legendarios y míticos** suben de nivel, del 1 al 10, con los repetidos que salen en los cofres (`characterLevel` y `copiesFor` en `engine.js`). Para pasar del nivel *n* al *n*+1 hacen falta ⌈*n*/2⌉ repetidos: 25 en total hasta el nivel 10. Cada nivel aumenta un **6 % el alcance** de sus poderes (+54 % en el nivel 10):

- Distancia: alcance del Disparo y de su pintura, radio de la Bomba, de Congelar, del Imán y del pincel del Rodillo.
- Duración, en los poderes sin distancia: Turbo, Burbuja y Fantasma.

Mientras queden premios nuevos en la rareza sorteada, 1 de cada 4 cofres da un repetido de un personaje tuyo que aún pueda subir. Los comunes no suben de nivel; sus repetidos, igual que los de un personaje en el nivel 10 o los de un color, se devuelven en estrellas. Los robots juegan siempre a nivel 1. En línea, el teléfono envía el nivel y el servidor solo acepta valores del 1 al 10. La colección muestra el nivel, los repetidos que faltan y el alcance extra.

La foto de perfil (arriba a la izquierda y en el ranking mundial) es el personaje elegido en ese momento.

## Cofres

| Cofre | Precio | Común | Raro | Épico | Legendario | Mítico |
| --- | --- | --- | --- | --- | --- | --- |
| Común | 300 ⭐ | 70% | 25% | 5% | — | — |
| Raro | 900 ⭐ | 35% | 45% | 15% | 5% | — |
| Épico | 2.500 ⭐ | — | 35% | 45% | 15% | 5% |
| Legendario | 6.000 ⭐ | — | — | 40% | 45% | 15% |

Se ganan cofres al terminar una partida (1 estrella → común, 2 → raro, victoria → épico), al subir de nivel (raro; legendario cada 5 niveles) y gratis cada 4 horas (común). Un perfil nuevo empieza con un cofre raro. Los cofres ganados en una partida (por subir de nivel o por el resultado) se guardan al momento, pero no se anuncian mientras juegas: al terminar aparecen en los resultados y se abren solos, uno tras otro. Dentro de la rareza sorteada se prioriza lo que aún no tienes; un repetido se devuelve en estrellas (40 a 640 según rareza). Los colores especiales también salen en cofres. Las probabilidades se muestran en la pantalla de cofres. No hay compras con dinero real.

## HUD y progreso

El HUD de cristal oscuro reproduce la composición de referencia: silueta de moto y nombre **CYBER_HAWK_01** arriba a la izquierda, barra cian al 80% y barra de energía con degradado cian/amarillo. La primera es un indicador visual de escudo, no un sistema de vida por impactos: las reglas siguen siendo de eliminación por corte. Se ilumina al 100% con escudo y cae a 0 al morir. La energía refleja el uso y la recarga de Dash Boost.

La clasificación muestra los tres líderes con nombres de piloto y puntuación entre paréntesis, calculada como `celdas × 20 + bajas × 1000`. El minimapa refleja territorios y estelas. Los controles respetan áreas seguras y tienen superficies táctiles de al menos 44 px.

Cada punto porcentual conquistado entrega 18 Bits y 30 XP; cada baja, 120 Bits y 100 XP. Se guarda el progreso al obtenerlo y cada 10 segundos. La partida en curso no se restaura al recargar. El nivel sigue `1 + floor((XP / 200)^(1 / 1.45))`.

Gato Rayo se regala en el nivel 2, Platillo Zum en el 5 y Dragoncito en el 10 (también pueden salir en cofres). El botón 🐢 del menú activa el **modo fácil**: los robots van más despacio, cazan desde más cerca y tu camino se dibuja más grueso. Los perfiles anteriores se migran solos: el antiguo contador de cofres pasa a cofres raros.

## Rangos y ranking mundial

Cada partida da o quita **copas 🏆** (`rankChange` en `engine.js`): −6 sin estrellas; +4, +10 o +18 con 1, 2 o 3 estrellas; +2 por cada rival atrapado (hasta 5); +20 por pintar todo el mapa. En línea, además, +8 al primero, +3 del 2.º al 3.º y −3 al último. Las copas nunca bajan de cero. Una sola vez por perfil (lo marca `ranked`), las copas suben hasta lo que vale su historial (`startingPoints`: 12 por victoria, 2 por rival atrapado y el porcentaje de su mejor zona, como mucho 1.000). Así, los perfiles de antes de los rangos no empiezan en cero, y como se toma el valor mayor, nada cuenta dos veces.

Hay **10 rangos con 3 niveles cada uno** (30 en total): Bronce, Plata, Oro, Platino, Esmeralda, Rubí, Diamante, Maestro, Gran Maestro y Leyenda, del 1 al 3. Cada nivel empieza en `40·n + 4·n²` copas (Bronce 2 en 44, Plata 1 en 156, Leyenda 3 en 4.524), así que cada uno pide un poco más que el anterior. Los emblemas son escudos SVG dibujados por código, con corona a partir de Maestro.

La pestaña **Rangos** muestra tu emblema, el avance al siguiente nivel, la escalera completa y el **ranking mundial**: los 50 jugadores con más copas. Para aparecer en él hay que entrar con Google. Cada jugador tiene una fila pública en Firestore, `ranking/{uid}` (nombre, copas y personaje), que se actualiza al abrir el juego con la sesión iniciada, al cambiar de nombre y al terminar cada partida. Quien nunca ha entrado con Google no tiene fila: en Firestore solo existen los jugadores con cuenta. Las reglas de `firestore.rules` dejan leerla a cualquiera y escribir solo la propia. Como las copas se calculan en el teléfono, alguien con conocimientos podría inflarlas; para evitarlo habría que calcularlas en el servidor.

## Misiones diarias, racha y avisos

- **Misiones:** 3 al día, iguales para todos (`missionsFor` elige según la fecha local), entre jugar partidas, atrapar rivales, pintar un porcentaje, recoger estrellas, usar poderes, jugar en línea y ganar. Cada una da estrellas al reclamarla, y completar las tres da un cofre raro. Cambian a medianoche.
- **Racha:** un premio al día durante 7 días seguidos (100, 150 ⭐, cofre común, 250, cofre raro, 400 y cofre épico), y después vuelve a empezar. Si faltas un día, empieza de nuevo en el día 1.
- El botón **Misiones diarias** del inicio muestra un punto rojo cuando hay algo por reclamar.
- **Avisos (solo en la APK, `@capacitor/local-notifications`):** tras la primera partida se pide permiso una vez. Al salir de la app se programan en el propio teléfono el aviso del cofre gratis y, a las 19:00, el de la racha.

## Invitar y emotes

- En una sala de amigos, **📤 Invitar** comparte un enlace `https://braktio.github.io/pintamundo/?sala=GATO42` (con `@capacitor/share` en la APK, el menú de compartir del navegador o el portapapeles). Al abrirlo, el juego entra en esa sala en cuanto el jugador tiene nombre.
- En las partidas en línea, el botón 😀 muestra 6 emotes. El servidor los reenvía a la sala (como mucho uno cada 1,5 s por jugador y solo de la lista) y aparecen en una burbuja sobre el personaje. No hay chat.

## Anuncios con recompensa

Solo en la APK, con Google AdMob (`ads.js`, plugin `@capacitor-community/admob`). No hay banners ni anuncios obligatorios: el jugador elige ver un vídeo a cambio de algo.

- Al terminar una partida: **📺 Duplica tus estrellas** (una vez por partida).
- Con el cofre gratis en espera: **📺 ¡Ábrelo ya!**, y la espera de 4 horas vuelve a empezar.

Al abrir la app, el anuncio empieza a cargarse en segundo plano. Si no hay ninguno listo, la oferta no aparece. Antes de cargarlo se pide el consentimiento de Google en los países que lo exigen, y los anuncios se limitan a contenido apto para todo público (`ParentalGuidance`).

- ID de la app: `ca-app-pub-8874186940779998~9639642633`, en `android/app/src/main/res/values/strings.xml`.
- Bloque bonificado: `REWARDED_ID` en `ads.js`. Con el bloque de prueba de Google se piden anuncios de prueba.

AdMob limita los anuncios reales hasta que la app esté publicada en Google Play y vinculada en su consola.

## Privacidad

`privacy.html` (https://braktio.github.io/pintamundo/privacy.html) explica qué datos se usan y cómo borrarlos; se enlaza desde la cuenta. En **☁️ Cuenta de Google → Borrar mis datos de la nube** se eliminan `users/{uid}` y `ranking/{uid}`; el progreso del teléfono se conserva.

## Música

`music.js` genera en tiempo real una pista cartoon de 16 compases a 124 BPM (melodía, acordes, bajo y percusión) con Web Audio. Suena en el menú y en las partidas cuando el sonido está activado; el botón de sonido controla a la vez la música y los efectos. El juego recuerda la elección; como los navegadores solo permiten sonar tras un toque, la música empieza con el primer toque. Se detiene al cambiar de pestaña o salir de la app.

## Perfil y guardado en la nube

La primera vez que se abre el juego pide un **nombre** (de 3 a 14 letras o números). Es el que ven los demás en línea y se cambia en **Progreso → 👤**. El progreso se guarda siempre en el teléfono. Ya no se puede exportar ni importar.

En la app de Android y en el navegador, **Progreso → ☁️ Guardar en mi cuenta** permite entrar con **Google** (Firebase Authentication) y guarda el perfil en Firestore, en `users/{uid}`. Así se recupera en otro teléfono. Funciona así (`cloud.js` y la sección *Profile and cloud save* de `game.js`):

- Cada cambio real del perfil lleva la hora (`updatedAt`). Al abrir la app gana la copia más reciente.
- Al conectar una cuenta que ya tiene progreso en un teléfono que también lo tiene, el jugador elige cuál conservar. Si cierra sin elegir, la cuenta no se conecta.
- Se sube como mucho una vez por minuto mientras juegas, y en seguida al terminar una partida, abrir un cofre, volver al menú o salir de la app.

La app usa el inicio de sesión nativo de Android; el navegador carga la versión web de Firebase desde `www.gstatic.com` y abre la ventana de Google. En el navegador solo funciona en los dominios autorizados en Firebase (*Authentication → Configuración → Dominios autorizados*): `localhost`, `braktio.github.io` y `pintamundo.onrender.com`.

### Configuración de Firebase

Proyecto de Firebase `pintamundo-74676` (plan Spark gratuito). La app Android `com.braktio.pintamundo` está registrada con la huella de la clave de firma (`firma-android/pintamundo.keystore`):

- SHA-1: `54:DF:4C:CE:10:D2:38:D2:22:1B:A1:D4:07:92:73:2E:1F:E6:CA:92`
- SHA-256: `BE:13:64:BF:75:37:52:B4:EE:67:4F:9C:B7:17:60:3D:83:6D:18:51:10:9F:DB:FF:CE:AC:62:1E:4B:63:07:EA`

- `android/app/google-services.json` es la configuración de Firebase. Se descarga de *Configuración del proyecto → Tus apps* y debe volver a descargarse si cambian los proveedores de acceso o las huellas. No es secreta: las reglas de Firestore son las que protegen los datos.
- *Authentication*: solo Google está activado. `capacitor.config.json` (`providers`) y `android/variables.gradle` (`rgcfaIncludeGoogle`) incluyen únicamente el SDK de Google.
- *Firestore*: las reglas están en `firestore.rules`; si cambian, hay que pegarlas de nuevo en la consola.

Plan gratuito de Firestore: 1 GiB, 50.000 lecturas y 20.000 escrituras al día. Cada jugador lee una vez al abrir y escribe como mucho una vez por minuto, así que alcanza para cientos de jugadores diarios.

Las estrellas, los cofres y los personajes se calculan en el teléfono y la nube guarda lo que este envía. Antes de vender nada con dinero real, la economía tiene que pasar al servidor.

## Multijugador en línea

Desde el inicio, **🌐 Jugar en línea** ofrece:

- **⚡ Jugar rápido**: entra en una sala pública; arranca a los 10 segundos y los robots rellenan los huecos hasta 7 jugadores.
- **👫 Crear sala para amigos**: genera un código (por ejemplo `GATO-42`); los amigos lo escriben en **Unirme** y el anfitrión (👑) pulsa **¡Empezar!**. Al terminar, todos vuelven a la misma sala.

Las partidas en línea no tienen límite de tiempo: terminan cuando ya no queda ningún jugador (todos atrapados o fuera) o cuando alguien pinta todo el mapa. Pintar más de la mitad es una victoria (3 estrellas), pero la partida sigue; si se atrapa a todos los robots, llegan hasta 3 nuevos. En solitario igual: termina al pintar todo el mapa o al ser atrapado. El servidor ejecuta el mismo `engine.js` 90 veces por segundo y es la autoridad: decide cortes, conquistas y recargas. Los teléfonos solo envían su rumbo y los botones de poder, y reciben unas 20 actualizaciones por segundo con lo que cambió (casillas, estelas, posiciones). Si alguien sale a mitad de partida, un robot ocupa su lugar. El jugador atrapado mira hasta el final. Los cofres y estrellas se ganan igual que en solitario.

No hay chat. Cada jugador aparece con su nombre de perfil, ya limpio de símbolos en el servidor; quien no tiene nombre aparece con el de su personaje.

### Probarlo en casa con dos teléfonos

1. Instala las dependencias una vez: `npm install` (solo `ws`, para las conexiones en vivo).
2. Arranca el servidor: `node server.mjs`.
3. En cada teléfono, conectado a la misma Wi-Fi, abre la dirección **En tu móvil** que imprime la terminal y pulsa **🌐 Jugar en línea**. El servidor se detecta solo.

Todos juegan en el servidor del juego, `wss://pintamundo.onrender.com/ws` (`PUBLIC_SERVER` en `online.js`): la APK, GitHub Pages y la web servida por Render. No hay forma de elegir otro. Solo la página servida por un servidor local de pruebas (`node server.mjs` en un PC) usa ese mismo servidor, para poder probar.

Archivos: `multiplayer.mjs` (salas, códigos, relleno con robots y envío de cambios), `online.js` (conexión, réplica de la partida y suavizado en el teléfono) y `server.mjs` (sirve el juego, `/ws` para las partidas y `/health` para los servicios de alojamiento). La comprobación `node scripts/online-check.mjs "ruta/a/chrome.exe"` abre dos pestañas que juegan la misma partida. `node scripts/replay-check.mjs "ruta/a/chrome.exe"` juega una partida rápida de 6 s (`MATCH_SECONDS` acorta las partidas del servidor) y comprueba que «¡OTRA PARTIDA!» lleva a una sala nueva.

## App de Android (APK)

El proyecto Android (Capacitor 8) está en `android/`. En cada cambio en `main`, GitHub Actions construye una APK firmada y la publica siempre en el mismo enlace: **Releases → «Pintamundo para Android» → `pintamundo.apk`**. Para instalarla, ábrela desde el teléfono y permite instalar apps de origen desconocido. Cada versión se instala encima de la anterior sin perder el progreso.

- La app va siempre en horizontal y a pantalla completa, con su icono y pantalla de carga (generados desde `assets/` con `npx capacitor-assets generate --android`).
- Las fuentes van dentro del juego (`fonts/`), así que funciona sin internet en el modo de un jugador.
- Para el modo en línea usa siempre `PUBLIC_SERVER` de `online.js`.
- Para construirla en local hace falta Java 21: `npm run android:sync` y luego `cd android && ./gradlew assembleRelease`.

**Clave de firma:** está en `firma-android/` (fuera de git) y en los secretos del repositorio (`PINTAMUNDO_KEYSTORE_B64`, `PINTAMUNDO_KEYSTORE_PASSWORD`). Sin ella no se pueden publicar actualizaciones, tampoco en Google Play; guarda una copia de seguridad.

## Google Play

GitHub Actions genera, además de la APK, **`pintamundo.aab`** (Android App Bundle), el archivo que se sube a Google Play, y lo publica en la misma versión «apk». La carpeta `play-store/` tiene el icono, el gráfico de funciones, las capturas (`scripts/store-shots.mjs`), los textos de la ficha, las respuestas de los formularios y los pasos para añadir a Firebase la huella de la Firma de apps de Play.

## Servidor en internet

El servidor público está en **https://pintamundo.onrender.com**, creado desde `render.yaml` como Blueprint de Render (plan gratuito, región Virginia): `npm ci --omit=dev`, `node server.mjs` y comprobación en `/health`. En el plan gratuito se duerme tras 15 minutos sin jugadores; el juego reintenta la conexión hasta un minuto mientras se despierta.

## Archivos

- `engine.js`: conquista, colisiones de punta, superposición de estelas, IA, Wall Surge, habilidades y validación del perfil.
- `renderer.js`: cámara ortográfica, personajes, efectos y la pintura: las zonas son manchas (un círculo por casilla, con bordes irregulares, salpicaduras y sombra) dibujadas en un lienzo aparte que se rehace como mucho unas 8 veces por segundo, y las estelas siguen el recorrido real del personaje (`path`) en lugar de las casillas.
- `game.js`: bucle, joystick invisible multitáctil, HUD, audio, orientación siempre horizontal, pantalla completa, rangos y persistencia.
- `music.js`: música de fondo generada con Web Audio.
- `cloud.js`: inicio de sesión con Google y copia del perfil en Firestore (solo en la app).
- `index.html` / `styles.css`: menú y HUD móvil horizontal.
- `ui/`: iconos cartoon de la interfaz (pestañas, nivel, cofres, modo fácil, sonido, ayuda, inicio), recortados a 192×192 con fondo transparente. Para cambiar uno basta con reemplazar su PNG con el mismo nombre.
- `server.mjs`: servidor local y de red sin dependencias.

El renderizado limita DPR a 1,5 y partículas a 500. Fronteras y franjas de territorio se cachean al cambiar la cuadrícula. No hay imágenes ni bibliotecas externas. La fuente Baloo 2 se carga desde Google Fonts; sin conexión se usa una fuente del sistema.

## Verificación

```powershell
node --test tests/*.test.js
```

Las pruebas cubren conquista, colisiones inofensivas, cortes enemigos, giro angular, límites, Wall Surge, 35 partículas, cámara ortográfica, habilidades, IA y guardado. La comprobación opcional `node scripts/browser-check.mjs "ruta/a/chrome.exe"` usa Chromium instalado con perfil temporal, sin descargar paquetes; desactiva su sandbox solo para esa prueba local. Verifica el HUD, conquista, progresión, cofres, giro del dispositivo y control con dos dedos. La emulación móvil no mide rendimiento en un teléfono físico.
