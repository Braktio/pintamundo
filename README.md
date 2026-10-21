# Pintamundo · ¡Pinta el mundo de tu color!

Versión infantil (antes *Neon Frontier*): tablero claro, colores de caramelo, personajes con cara, textos sencillos, botones grandes, sonidos de dibujos animados y modo fácil. Las reglas del juego son las mismas.

Juego de conquista territorial para smartphones en **horizontal**, con Canvas 2D y JavaScript modular. La cámara es cenital ortográfica a 90°: no tiene inclinación, perspectiva, escalas distintas por eje ni retraso al seguir al piloto. El jugador permanece en el centro exacto del canvas.

## Ejecutar y abrir en el teléfono

Abre la carpeta en VS Code y ejecuta, con Node.js 18 o superior:

```powershell
node server.mjs
```

En el PC visita **http://localhost:5173**. En el teléfono, conectado a la misma red Wi-Fi, abre la dirección **En tu móvil** que imprime la terminal. El servidor escucha la red local; puedes limitarlo al PC con `$env:HOST='127.0.0.1'`. No necesitas instalar paquetes ni compilar.

También puedes abrir `index.html` con **Live Server** y usar la IP local y su puerto desde el teléfono. Los módulos JavaScript requieren HTTP; `file://` no funciona.

## Control móvil

- Usa el joystick izquierdo o arrastra sobre la arena para dirigir. La moto avanza continuamente y mantiene el rumbo al soltar.
- El giro está limitado a **0,1 radianes por fotograma a 60 Hz**, equivalente a 6 rad/s. Se integra con un paso fijo de 90 Hz para conservar la misma velocidad angular entre dispositivos.
- Los dos botones derechos activan las habilidades. Admiten un segundo dedo mientras mantienes el joystick.
- **Ⅱ** pausa. Cambiar de pestaña o girar el móvil también pausa. En vertical aparece un aviso para girarlo a horizontal.
- **⛶** solicita pantalla completa y bloqueo horizontal cuando el navegador lo permite. Si no lo admite, se juega en la ventana del navegador.
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

Hay seis bots con rutas de expansión y caza de estelas. Respetan escudos y la invisibilidad de Corte Rápido. Una baja transfiere al atacante el 25% del territorio rival, redondeado hacia abajo; el resto queda neutral. Conquistar **más del 50%** gana la partida y un cofre gratuito.

## Personajes, rareza y poderes

Hay 37 personajes dibujados por código (`CHARACTERS` en `engine.js`): 12 comunes, 9 raros, 7 épicos, 5 legendarios y 4 míticos. Los poderes son del personaje, no del nivel:

| Rareza | Poderes | Recarga |
| --- | --- | --- |
| Común | Ninguno | — |
| Raro | 1 básico (Turbo, Burbuja o Imán) | ×1 |
| Épico | 1 fuerte (Disparo, Fantasma o Rodillo) | ×0,9 |
| Legendario | 2 | ×0,8 |
| Mítico | 2, incluida Bomba o Congelar | ×0,65 |

| Poder | Duración | Recarga base | Efecto |
| --- | --- | --- | --- |
| 🚀 Turbo | 3 s | 10 s | Velocidad ×1,6 |
| 🛡️ Burbuja | 1,5 s | 16 s | Protege la estela y desvía al atacante |
| 🧲 Imán | 4 s | 14 s | Atrae estrellas próximas |
| 👻 Fantasma | 3 s | 16 s | Oculta a la IA la mitad reciente de la estela |
| 🎯 Disparo | instantáneo | 8 s | Bola de pintura: si cruza la estela expuesta de un rival, lo elimina; si toca su cuerpo, lo aturde 0,6 s. La Burbuja la bloquea |
| 🖌️ Rodillo | 3 s | 18 s | Pinta un pincel de 3×3 por donde pasas, sin dejar estela; si tenías estela expuesta, se cierra |
| 💥 Bomba de color | instantáneo | 22 s | Conquista un círculo de radio 3,6 alrededor y cierra la estela expuesta |
| ❄️ Congelar | instantáneo | 20 s | Inmoviliza 1,6 s a los rivales a menos de 8 celdas (no a los que tienen Burbuja) |

Los bots también reciben personajes al azar (los raros aparecen menos) y usan sus poderes. En modo fácil solo salen comunes y raros, y nunca disparan ni congelan. Turbo y Wall Surge se combinan: ×1,6 ×1,35 = ×2,16. Recoger una estrella da 4 Bits, 2 XP y un borde extra de una celda en los cierres durante 10 segundos.

## Cofres

| Cofre | Precio | Común | Raro | Épico | Legendario | Mítico |
| --- | --- | --- | --- | --- | --- | --- |
| Común | 300 ⭐ | 70% | 25% | 5% | — | — |
| Raro | 900 ⭐ | 35% | 45% | 15% | 5% | — |
| Épico | 2.500 ⭐ | — | 35% | 45% | 15% | 5% |
| Legendario | 6.000 ⭐ | — | — | 40% | 45% | 15% |

Se ganan cofres al terminar una partida (1 estrella → común, 2 → raro, victoria → épico), al subir de nivel (raro; legendario cada 5 niveles) y gratis cada 4 horas (común). Un perfil nuevo empieza con un cofre raro. Dentro de la rareza sorteada se prioriza lo que aún no tienes; un repetido se devuelve en estrellas (40 a 640 según rareza). Los colores especiales también salen en cofres. Las probabilidades se muestran en la pantalla de cofres. No hay compras con dinero real.

## HUD y progreso

El HUD de cristal oscuro reproduce la composición de referencia: silueta de moto y nombre **CYBER_HAWK_01** arriba a la izquierda, barra cian al 80% y barra de energía con degradado cian/amarillo. La primera es un indicador visual de escudo, no un sistema de vida por impactos: las reglas siguen siendo de eliminación por corte. Se ilumina al 100% con escudo y cae a 0 al morir. La energía refleja el uso y la recarga de Dash Boost.

La clasificación muestra los tres líderes con nombres de piloto y puntuación entre paréntesis, calculada como `celdas × 20 + bajas × 1000`. El minimapa refleja territorios y estelas. Los controles respetan áreas seguras y tienen superficies táctiles de al menos 44 px.

Cada punto porcentual conquistado entrega 18 Bits y 30 XP; cada baja, 120 Bits y 100 XP. Se guarda el progreso al obtenerlo y cada 10 segundos. La partida en curso no se restaura al recargar. El nivel sigue `1 + floor((XP / 200)^(1 / 1.45))`.

Gato Rayo se regala en el nivel 2, Platillo Zum en el 5 y Dragoncito en el 10 (también pueden salir en cofres). El botón 🐢 del menú activa el **modo fácil**: los robots van más despacio, cazan desde más cerca y tu camino se dibuja más grueso. Los perfiles anteriores se migran solos: el antiguo contador de cofres pasa a cofres raros. Exportación e importación de perfil disponibles en el menú.

## Archivos

- `engine.js`: conquista, colisiones de punta, superposición de estelas, IA, Wall Surge, habilidades y validación del perfil.
- `renderer.js`: cámara ortográfica, motos cenitales sombreadas, plasma, glow, chispas y estelas rotas.
- `game.js`: bucle, joystick multitáctil, HUD, audio, orientación, pantalla completa y persistencia.
- `index.html` / `styles.css`: menú y HUD móvil horizontal.
- `server.mjs`: servidor local y de red sin dependencias.

El renderizado limita DPR a 1,5 y partículas a 500. Fronteras y franjas de territorio se cachean al cambiar la cuadrícula. No hay imágenes ni bibliotecas externas. La fuente Baloo 2 se carga desde Google Fonts; sin conexión se usa una fuente del sistema.

## Verificación

```powershell
node --test tests/*.test.js
```

Las pruebas cubren conquista, colisiones inofensivas, cortes enemigos, giro angular, límites, Wall Surge, 35 partículas, cámara ortográfica, habilidades, IA y guardado. La comprobación opcional `node scripts/browser-check.mjs "ruta/a/chrome.exe"` usa Chromium instalado con perfil temporal, sin descargar paquetes; desactiva su sandbox solo para esa prueba local. Verifica el HUD, conquista, progresión, cofres, giro del dispositivo y control con dos dedos. La emulación móvil no mide rendimiento en un teléfono físico.
