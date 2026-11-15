// Catálogo de SantiGames. Para publicar un juego nuevo, añade un objeto a "juegos".
// estado: 'disponible' o 'desarrollo'. Solo un juego debería tener destacado: true.
window.SANTIGAMES = {
  // Escribe aquí el correo público del estudio para que aparezca en la página "El estudio".
  contacto: 'sabenedettoa@benedettowebs.cl',
  juegos: [
    {
      titulo: 'Cielo Abierto',
      genero: 'Simulador de vuelo 3D',
      resumen: 'Pilota el Albatros 72, el turbohélice de la aerolínea Cielo Abierto: lleva a 48 pasajeros entre las montañas de una isla low-poly y aterriza tan suave que te aplaudan.',
      estado: 'disponible',
      plataforma: 'Navegador · teclado o táctil',
      portada: 'juegos/cielo-abierto/portada.svg',
      ficha: 'juegos/cielo-abierto/index.html',
      jugar: 'juegos/cielo-abierto/jugar.html',
      destacado: true,
    },
  ],
};
