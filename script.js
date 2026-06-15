// ==========================================================
// SCRIPT.JS - LÓGICA DE INTERACCIÓN Y VALIDACIÓN DE CABAÑAS
// ==========================================================

document.addEventListener('DOMContentLoaded', () => {
    
    // 🔴 ENLACE UNIFICADO DE TU API GOOGLE SHEETS
    const API_URL = 'https://script.google.com/macros/s/AKfycbz4pFHwCfKEhodnpHwDAe8ZiPjp6fTMKnD_0WWdV7aXKL7p8Zw_ruuxYP_0l_7HGEMsLw/exec';

    // 1. DESPLEGABLE DE GALERÍA DE CABAÑAS
    const btnAbrirCabanas = document.getElementById('btn-abrir-cabanas');
    const cabinsDropdown = document.getElementById('cabins-dropdown');
    
    if (btnAbrirCabanas && cabinsDropdown) {
        btnAbrirCabanas.addEventListener('click', (e) => {
            e.preventDefault();
            cabinsDropdown.classList.toggle('show');
            const icono = btnAbrirCabanas.querySelector('.link-icon-right i');
            if (icono) {
                icono.classList.toggle('fa-chevron-down');
                icono.classList.toggle('fa-chevron-up');
            }
        });
    }

    // 2. CONTROL DE APERTURA Y CIERRE DE MODALES (TARJETAS GRANDES)
    const openModals = document.querySelectorAll('.room-item, .btn-reservation');
    const overlay = document.getElementById('modal-overlay');
    const closeBotones = document.querySelectorAll('.close-modal');
    const tarjetas = document.querySelectorAll('.modal-card');

    openModals.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault(); 
            const targetId = btn.getAttribute('data-target');
            const tarjetaDestino = document.getElementById(targetId);
            if (tarjetaDestino) {
                tarjetaDestino.classList.add('active');
                overlay.classList.add('active');
                document.body.style.overflow = 'hidden'; // Evita scroll de fondo
            }
        });
    });

    function cerrarModales() {
        overlay.classList.remove('active');
        tarjetas.forEach(t => t.classList.remove('active'));
        document.body.style.overflow = 'auto'; // Restaura scroll
        
        // Limpia resultados anteriores del consultor al cerrar
        const resultBox = document.getElementById('result-box');
        if (resultBox) { resultBox.style.display = 'none'; }
    }

    closeBotones.forEach(btn => btn.addEventListener('click', cerrarModales));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrarModales(); });

    // 3. LÓGICA DEL CONTROLADOR DE HUÉSPEDES (+ / -) 
    const btnsCount = document.querySelectorAll('.btn-count');
    btnsCount.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const inputId = btn.getAttribute('data-target');
            const input = document.getElementById(inputId);
            if (!input) return;

            let val = parseInt(input.value) || 0;
            
            if (btn.classList.contains('plus')) {
                val++;
            } else if (btn.classList.contains('minus') && val > 0) {
                val--;
            }
            
            // Restricción estricta: Mínimo debe haber 1 adulto
            if (inputId === 'count-adults' && val < 1) {
                val = 1;
            }
            if (inputId === 'count-kids' && val < 0) {
                val = 0;
            }
            
            input.value = val;
        });
    });

    // 4. CONFIGURACIÓN DE FECHAS MÍNIMAS EN EL CALENDARIO
    const inputEntrada = document.getElementById('cons-entrada');
    const inputSalida = document.getElementById('cons-salida');
    
    if (inputEntrada && inputSalida) {
        // Se establece la hora local para evitar problemas de zona horaria
        const hoy = new Date();
        const fechaLocal = new Date(hoy.getTime() - (hoy.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        
        inputEntrada.min = fechaLocal;
        inputEntrada.addEventListener('change', () => { 
            inputSalida.min = inputEntrada.value; 
        });
    }

    // 5. COMPROBADOR DE DISPONIBILIDAD INTELIGENTE
    const btnBuscar = document.getElementById('btn-buscar-dispo');
    const loadingBox = document.getElementById('loading-box');
    const resultBox = document.getElementById('result-box');

    if (btnBuscar) {
        btnBuscar.addEventListener('click', async (e) => {
            e.preventDefault();

            const cabana = document.getElementById('cons-cabana').value;
            const fEntrada = inputEntrada.value;
            const fSalida = inputSalida.value;
            const adultos = document.getElementById('count-adults').value || 1;
            const ninos = document.getElementById('count-kids').value || 0;

            if (!fEntrada || !fSalida) { 
                alert("Por favor, selecciona las fechas completas de ingreso y salida."); 
                return; 
            }
            if (fEntrada >= fSalida) { 
                alert("La fecha de salida tiene que ser posterior a la fecha de entrada."); 
                return; 
            }

            btnBuscar.style.display = 'none';
            resultBox.style.display = 'none';
            loadingBox.style.display = 'block';

            try {
                // Lectura de la base de datos de Google Sheets
                const respuesta = await fetch(API_URL);
                const reservas = await respuesta.json();

                const checkInDate = new Date(fEntrada + 'T12:00:00');
                const checkOutDate = new Date(fSalida + 'T12:00:00');

                // Filtrar las reservas que pertenecen a la cabaña elegida
                const reservasCabana = reservas.filter(res => String(res.cabana).toLowerCase().trim() === String(cabana).toLowerCase().trim());

                // Detectar si hay reservas que se crucen con el rango pedido
                const solapadas = reservasCabana.filter(res => {
                    const resEntrada = new Date(res.ingreso + 'T12:00:00');
                    const resSalida = new Date(res.salida + 'T12:00:00');
                    return checkInDate < resSalida && checkOutDate > resEntrada;
                });

                const estaOcupado = solapadas.length > 0;

                setTimeout(() => {
                    loadingBox.style.display = 'none';
                    resultBox.style.display = 'block';
                    btnBuscar.style.display = 'block';
                    btnBuscar.textContent = "Buscar otra fecha";

                    if (estaOcupado) {
                        
                        // LÓGICA DE SUGERENCIA DE PRÓXIMA FECHA
                        let fechaSugerida = new Date(checkInDate);
                        
                        // Caminar día por día hasta encontrar una fecha que no esté dentro de una reserva
                        while(reservasCabana.some(res => {
                            const rIn = new Date(res.ingreso + 'T12:00:00');
                            const rOut = new Date(res.salida + 'T12:00:00');
                            return fechaSugerida >= rIn && fechaSugerida < rOut;
                        })) {
                            fechaSugerida.setDate(fechaSugerida.getDate() + 1);
                        }

                        // Si el día de ingreso está libre pero el bloqueo está en medio del viaje (Ej: quiero del 16 al 20, y la reserva está el 18)
                        if (fechaSugerida.getTime() === checkInDate.getTime()) {
                            // Encontrar la fecha de salida máxima de las reservas que chocan
                            let maxSalida = new Date(Math.max(...solapadas.map(r => new Date(r.salida + 'T12:00:00').getTime())));
                            fechaSugerida = new Date(maxSalida);
                            
                            // Verificar que esa salida no choque justo con OTRA reserva
                            while(reservasCabana.some(res => {
                                const rIn = new Date(res.ingreso + 'T12:00:00');
                                const rOut = new Date(res.salida + 'T12:00:00');
                                return fechaSugerida >= rIn && fechaSugerida < rOut;
                            })) {
                                fechaSugerida.setDate(fechaSugerida.getDate() + 1);
                            }
                        }

                        // Dar formato legible a la fecha
                        const opciones = { weekday: 'long', day: 'numeric', month: 'long' };
                        let fechaTexto = fechaSugerida.toLocaleDateString('es-ES', opciones);
                        fechaTexto = fechaTexto.charAt(0).toUpperCase() + fechaTexto.slice(1);

                        resultBox.className = "result-box error";
                        resultBox.innerHTML = `
                            <i class="fa-solid fa-circle-xmark" style="font-size: 1.8rem; margin-bottom: 8px; color: #ef4444;"></i>
                            <p>Lo sentimos, <strong>${cabana}</strong> tiene fechas ocupadas en tu búsqueda.</p>
                            <div style="background: #fef2f2; border-radius: 8px; padding: 12px; margin-top: 12px; border: 1px solid #fca5a5;">
                                <p style="margin: 0; color: #b91c1c; font-size: 0.85rem; line-height: 1.4;">
                                    <i class="fa-solid fa-calendar-day"></i> Próxima disponibilidad sugerida:<br>
                                    <strong>A partir del ${fechaTexto} en la tarde.</strong>
                                </p>
                            </div>
                        `;
                    } else {
                        // Texto súper limpio para WhatsApp (Sin emojis conflictivos)
                        const textoPlano = `Hola Vista Iliniza Lodge, verifiqué disponibilidad en su sistema virtual y deseo proceder con la reserva de la *${cabana}*.\n\nFecha de Ingreso: ${fEntrada}\nFecha de Salida: ${fSalida}\nDetalles: ${adultos} Adultos y ${ninos} Niños.`;
                        const mensajeWspCodificado = encodeURIComponent(textoPlano);
                        
                        resultBox.className = "result-box success";
                        resultBox.innerHTML = `
                            <i class="fa-solid fa-circle-check" style="font-size: 1.8rem; margin-bottom: 8px; color: #10b981;"></i>
                            <p>¡Disponibilidad Confirmada! La <strong>${cabana}</strong> se encuentra libre para las fechas indicadas.</p>
                            <a href="https://wa.me/593999366565?text=${mensajeWspCodificado}" target="_blank" class="btn-wsp-success">
                                <i class="fa-brands fa-whatsapp"></i> Continuar reserva en WhatsApp
                            </a>
                        `;
                    }
                }, 1500);

            } catch (error) {
                loadingBox.style.display = 'none';
                btnBuscar.style.display = 'block';
                console.error(error);
                alert("Ocurrió un inconveniente al conectar con el servidor de ocupación. Inténtalo de nuevo.");
            }
        });
    }

});