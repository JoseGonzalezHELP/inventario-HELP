// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCNjNkWCGxcpQ9KglW7nLerNTpnsmGkkLw",
  authDomain: "inventario-hepl-biomedica.firebaseapp.com",
  databaseURL: "https://inventario-hepl-biomedica-default-rtdb.firebaseio.com",
  projectId: "inventario-hepl-biomedica",
  storageBucket: "inventario-hepl-biomedica.firebasestorage.app",
  messagingSenderId: "843964981869",
  appId: "1:843964981869:web:bed7e15ddc20c9a30e9564",
  measurementId: "G-FFYZ2HL9S1"
};

// Inicializa Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Prueba de conexión
database.ref('.info/connected').on('value', (snapshot) => {
  const connectionStatus = document.getElementById('connection-status');
  
  if (snapshot.val() === true) {
    console.log("✅ Conectado a Firebase");
    if (connectionStatus) {
      connectionStatus.textContent = "Conectado";
      connectionStatus.style.color = "green";
    }
  } else {
    console.error("❌ Error de conexión a Firebase - Verifica tu conexión a internet");
    if (connectionStatus) {
      connectionStatus.textContent = "Desconectado - Verifica tu internet";
      connectionStatus.style.color = "red";
    }
    // Intenta reconectar después de 5 segundos
    setTimeout(() => {
      database.ref('.info/connected').once('value');
    }, 5000);
  }
});

// Referencias a la base de datos
const inventoryRef = database.ref('inventory');
const entriesRef = database.ref('entries');
const outputsRef = database.ref('outputs');
const typesRef = database.ref('types');
const brandsRef = database.ref('brands');  
const areasRef = database.ref('areas');
// Contraseña para eliminar (cambia esta contraseña por una segura)
const DELETE_PASSWORD = "admin123";

// Datos en memoria
let inventory = [];
let entries = [];
let outputs = [];
let qrScanner = null;
let itemTypes = [];
let itemBrands = [];  
let areas = [];
// Variables para múltiples insumos
let selectedEntryItems = [];
let selectedOutputItems = [];
let editingOutputId = null;

// Función para verificar contraseña antes de eliminar
function verifyPasswordBeforeDelete(action, id) {
    const password = prompt("🔒 Ingrese la contraseña para eliminar:");
    
    if (password === DELETE_PASSWORD) {
        if (action === 'deleteItem') {
            deleteItem(id);
        } else if (action === 'deleteEntry') {
            deleteEntry(id);
        } else if (action === 'deleteOutput') {
            deleteOutput(id);
        }
    } else if (password !== null) {
        alert("❌ Contraseña incorrecta. No se puede eliminar.");
    }
}

// Función para eliminar entrada
function deleteEntry(id) {
    const entry = entries.find(e => e.id === id);
    if (!entry) {
        alert('Entrada no encontrada');
        return;
    }
    
    // Restaurar stock
    const itemIndex = inventory.findIndex(i => i.id === entry.itemId);
    if (itemIndex !== -1) {
        const item = inventory[itemIndex];
        const newStock = item.stock - entry.quantity;
        
        inventoryRef.child(entry.itemId).update({ stock: newStock })
            .then(() => {
                // Eliminar la entrada de Firebase
                entriesRef.child(id).remove()
                    .then(() => {
                        showToast('✅ Entrada eliminada correctamente');
                    })
                    .catch(error => {
                        alert('Error al eliminar entrada: ' + error.message);
                    });
            })
            .catch(error => {
                alert('Error al actualizar stock: ' + error.message);
            });
    } else {
        // Si no encuentra el item, igual eliminar la entrada
        entriesRef.child(id).remove()
            .then(() => {
                showToast('✅ Entrada eliminada correctamente');
            })
            .catch(error => {
                alert('Error al eliminar entrada: ' + error.message);
            });
    }
}

// Función para eliminar salida
function deleteOutput(id) {
    const output = outputs.find(o => o.id === id);
    if (!output) {
        alert('Salida no encontrada');
        return;
    }
    
    // Restaurar stock solo si no es préstamo pendiente
    if (output.movementType !== 'loan' || output.status !== 'pending') {
        const itemIndex = inventory.findIndex(i => i.id === output.itemId);
        if (itemIndex !== -1) {
            const item = inventory[itemIndex];
            const newStock = item.stock + output.quantity;
            
            inventoryRef.child(output.itemId).update({ stock: newStock })
                .then(() => {
                    // Eliminar la salida de Firebase
                    outputsRef.child(id).remove()
                        .then(() => {
                            showToast('✅ Salida eliminada correctamente');
                        })
                        .catch(error => {
                            alert('Error al eliminar salida: ' + error.message);
                        });
                })
                .catch(error => {
                    alert('Error al actualizar stock: ' + error.message);
                });
        } else {
            // Si no encuentra el item, igual eliminar la salida
            outputsRef.child(id).remove()
                .then(() => {
                    showToast('✅ Salida eliminada correctamente');
                })
                .catch(error => {
                    alert('Error al eliminar salida: ' + error.message);
                });
        }
    } else {
        // Para préstamos pendientes, solo eliminar sin restaurar stock
        outputsRef.child(id).remove()
            .then(() => {
                showToast('✅ Salida eliminada correctamente');
            })
            .catch(error => {
                alert('Error al eliminar salida: ' + error.message);
            });
    }
}

// Modificar la función confirmDeleteItem existente
function confirmDeleteItem(id) {
    verifyPasswordBeforeDelete('deleteItem', id);
}


// Variables para el sistema de folios
let currentFolioData = { year: null, letter: 'A', number: 1 };
const foliosRef = database.ref('folios');

// Función para generar el próximo folio
function generateNextFolio() {
    const currentYear = new Date().getFullYear().toString().slice(-2);
    
    // Si el año cambió, reiniciar la secuencia
    if (currentFolioData.year !== currentYear) {
        currentFolioData = { 
            year: currentYear, 
            letter: 'A', 
            number: 1 
        };
        saveFolioData();
        return formatFolio(currentFolioData);
    }
    
    // Incrementar número
    currentFolioData.number++;
    
    // Si llegamos a 99, cambiar letra y reiniciar número
    if (currentFolioData.number > 99) {
        currentFolioData.number = 1;
        
        // Obtener la siguiente letra del alfabeto
        const nextCharCode = currentFolioData.letter.charCodeAt(0) + 1;
        
        // Si pasamos de Z, reiniciar a A (no debería pasar en un año)
        if (nextCharCode > 90) { // 90 es el código de 'Z'
            currentFolioData.letter = 'A';
        } else {
            currentFolioData.letter = String.fromCharCode(nextCharCode);
        }
    }
    
    saveFolioData();
    return formatFolio(currentFolioData);
}
// Formatear el folio
function formatFolio(data) {
    return `${data.year}${data.letter}${data.number.toString().padStart(2, '0')}`;
}

// Guardar datos del folio en Firebase
function saveFolioData() {
    foliosRef.set(currentFolioData);
}



// Cargar datos del folio desde Firebase
function loadFolioData() {
    foliosRef.once('value').then(snapshot => {
        const data = snapshot.val();
        if (data) {
            currentFolioData = data;
            
            // Verificar si el año cambió
            const currentYear = new Date().getFullYear().toString().slice(-2);
            if (currentFolioData.year !== currentYear) {
                currentFolioData = { 
                    year: currentYear, 
                    letter: 'A', 
                    number: 1 
                };
                saveFolioData();
            }
        }
    });
}

// Función para mostrar notificaciones toast
function showToast(message) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.padding = '10px 20px';
    toast.style.backgroundColor = '#4CAF50';
    toast.style.color = 'white';
    toast.style.borderRadius = '5px';
    toast.style.zIndex = '1000';
    document.body.appendChild(toast);
  }
  
  toast.textContent = message;
  toast.style.display = 'block';
  
  setTimeout(() => {
    toast.style.display = 'none';
  }, 3000);
}


// Función para formatear fecha en formato dd/mm/aaaa
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
}

// ===== FUNCIONES PARA ORDEN DE SERVICIO ===== //

// ===== FUNCIÓN PARA GENERAR LA ORDEN DE SERVICIO (VERSIÓN CORREGIDA) =====
function generateServiceOrder(type, data) {
    // Usar la fecha del registro si está disponible, de lo contrario usar la fecha actual
    const recordDate = data.date ? new Date(data.date) : new Date();
    const formattedDate = recordDate.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    
    // Obtener fecha actual para "fecha de terminación"
    const today = new Date();
    const todayFormatted = today.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    
    let materialsHTML = '';
    if (type === 'output') {
        materialsHTML = `
            <tr>
                <td>${data.quantity}</td>
                <td>Pieza</td>
                <td>${data.itemName} (${data.itemId})</td>
                <td></td>
                <td></td>
                <td></td>
            </tr>
        `;
    } else if (type === 'entry') {
        materialsHTML = `
            <tr>
                <td>${data.quantity}</td>
                <td>Pieza</td>
                <td>${data.itemName} (${data.itemId})</td>
                <td></td>
                <td></td>
                <td></td>
            </tr>
        `;
    }
    
    let description = '';
    let report = '';
    let workers = '';
    let areaText = '';
    let responsibleName = '';
    
    if (type === 'output') {
        description = `Solicitud de ${data.movementType === 'loan' ? 'préstamo' : 'salida'} de insumo biomédico`;
        report = `Entrega de ${data.quantity} unidad(es) de insumo biomédico ${data.itemName}`;
        workers = data.engineer || 'Personal de biomédica';
        responsibleName = data.engineer || 'Personal de biomédica';
        areaText = `Departamento o área: ${data.area || 'Área solicitante'}`;
    } else if (type === 'entry') {
        description = `Recepción de insumos biomédicos en el almacén`;
        report = `Recepción de ${data.quantity} unidad(es) de insumo biomédico ${data.itemName}`;
        workers = data.responsible || 'Personal de almacén';
        responsibleName = data.responsible || 'Personal de almacén';
        areaText = 'Departamento o área: Almacén Biomédico';
    }
    
    const serviceOrderHTML = `
        <div class="service-order-container">
            <div class="images-container">
                <div class="logo left-logo">
                    <img src="https://raw.githubusercontent.com/JoseGonzalezHELP/inventario-HELP/main/SecretariaDeSalud.png" alt="Secretaría de Salud" height="110" onerror="this.style.display='none'; this.parentNode.innerHTML='[Imagen 1 - Secretaría de Salud]'">
                </div>
                <div class="logo right-logo">
                    <img src="./PEDIATRICO.jpg" alt="Hospital Pediátrico" height="80" onerror="this.style.display='none'; this.parentNode.innerHTML='[Imagen 2 - Hospital]'">
                </div>
            </div>
            
            <div class="hospital-name">HOSPITAL DE ESPECIALIDADES PEDIÁTRICO LEÓN</div>
            
            <div class="header-info">
                <div class="order-title">ORDEN DE SERVICIO</div>
                <div class="right-header">
                    <div class="folio">No. de Folio: <span class="folio-input">${type === 'output' ? data.os : data.voucher}</span></div>
                    <div class="department">DEPARTAMENTO DE CONSERVACIÓN, MANTENIMIENTO,<br>BIOMÉDICA E INFORMÁTICA</div>
                </div>
            </div>
            
            <div class="serial-number-container">
                <div class="serial-number-field">
                    <span>No. de serie de equipo:</span>
                    <div class="serial-input" contenteditable="true"></div>
                </div>
            </div>
            
            <div class="expedition-container">
                <div></div>
                <div class="expedition-date">
                    <span>Fecha de Expediente</span>
                    <div class="date-field"></div>
                    <div class="oval-rectangle">MP</div>
                    <div class="oval-rectangle">MC</div>
                </div>
            </div>
            
            <div class="reference-data">
                <div class="data-row">
                    <div class="data-field">
                        <div class="section-title">Datos de referencia:</div>
                    </div>
                </div>
                <div class="data-row">
                    <div class="data-field">
                        <div class="underline">Fecha de reporte: ${formattedDate}</div>
                    </div>
                    <div class="data-field">
                        <div class="underline">Fecha de terminación: ${todayFormatted}</div>
                    </div>
                </div>
                <div class="data-row">
                    <div class="data-field" style="flex: 1;">
                        <div class="underline">${areaText}</div>
                    </div>
                </div>
            </div>
            
            <div class="section">
                <div class="section-title">Descripción y problema presentado en el área:</div>
                <div class="text-area" contenteditable="true">${description}</div>
            </div>
            
            <div class="section">
                <div class="section-title">Reporte de trabajo realizado:</div>
                <div class="text-area" contenteditable="true">${report}</div>
            </div>
            
            <div class="section">
                <div class="section-title">Trabajadores: (Nombres):</div>
                <div class="text-area" contenteditable="true">${workers}</div>
            </div>
            
            <div class="centered-title">Materiales:</div>
            <div class="materials-container">
                <table>
                    <thead>
                        <tr>
                            <th width="10%">Cant.</th>
                            <th width="15%">Unidad</th>
                            <th width="35%">Descripción</th>
                            <th width="15%">Costo almacén</th>
                            <th width="15%">Compra directa</th>
                            <th width="10%">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${materialsHTML}
                        <tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>
                        <tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>
                    </tbody>
                </table>
            </div>
            
            <div class="footer-container">
                <div class="signatures-container">
                    <div class="signature-box">
                        <div class="signature-title">Autoriza salida de material</div>
                        <div class="signature-line"></div>
                        <div class="signature-name">El jefe de mantenimiento,<br>biomédica e informática</div>
                    </div>
                    <div class="signature-box">
                        <div class="signature-title">Realizó trabajo</div>
                        <div class="signature-line"></div>
                        <div class="signature-name">${responsibleName}</div>
                    </div>
                    <div class="signature-box">
                        <div class="signature-title">Recibe a satisfacción</div>
                        <div class="signature-line"></div>
                        <div class="signature-name">El Jefe del área solicitante</div>
                    </div>
                </div>
                
                <div class="note-box">
                    Nota: Si los materiales usados no caben en este lado, anótelos en la parte de atrás.
                </div>
            </div>
        </div>
    `;
    
    return serviceOrderHTML;
}
// Función para mostrar la orden de servicio
function showServiceOrder(type, data) {
    const orderHTML = generateServiceOrder(type, data);
    document.getElementById('serviceOrderContent').innerHTML = orderHTML;
    document.getElementById('serviceOrderModal').style.display = 'block';
}


// Función para imprimir la orden de servicio (VERSIÓN OPTIMIZADA PARA PDF)
function printServiceOrder() {
    // Obtener el contenido de la orden de servicio
    const serviceOrderContent = document.getElementById('serviceOrderContent');
    
    // Crear HTML optimizado para impresión PDF
    const printHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Orden de Servicio</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                /* Reset y configuración general */
                * {
                    box-sizing: border-box;
                    margin: 0;
                    padding: 0;
                    font-family: Arial, sans-serif;
                }
                body {
                    margin: 0;
                    padding: 5mm;
                    width: 100%;
                    font-size: 10pt;
                    line-height: 1.2;
                    color: #000;
                    background: #fff;
                }
                
                /* Contenedor principal - medidas exactas para A4 */
                .service-order-container {
                    width: 180mm;
                    max-width: 180mm;
                    margin: 0 auto;
                    padding: 5mm;
                    background: white;
                }
                
                /* Encabezado con logos */
                .images-container {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 3mm;
                    width: 100%;
                }
                .left-logo, .right-logo {
                    flex: 1;
                    text-align: center;
                    max-width: 45%;
                }
                .logo img {
                    max-height: 25mm;
                    width: auto;
                }
                
                /* Nombre del hospital */
                .hospital-name {
                    text-align: center;
                    font-size: 12pt;
                    font-weight: bold;
                    margin: 2mm 0 4mm 0;
                    text-transform: uppercase;
                    width: 100%;
                }
                
                /* Sección de folio y departamento */
                .header-info {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 4mm;
                    width: 100%;
                }
                .order-title {
                    font-weight: bold;
                    text-transform: uppercase;
                    font-size: 12pt;
                }
                .right-header {
                    text-align: right;
                }
                .folio {
                    font-weight: bold;
                    font-size: 10pt;
                    margin-bottom: 1mm;
                }
                .folio-input {
                    display: inline-block;
                    width: 25mm;
                    border-bottom: 1px solid #000;
                    height: 5mm;
                }
                .department {
                    font-weight: bold;
                    text-transform: uppercase;
                    font-size: 8pt;
                    line-height: 1.1;
                }
                
                /* Número de serie */
                .serial-number-container {
                    margin: 3mm 0;
                    width: 100%;
                }
                .serial-number-field {
                    display: flex;
                    align-items: center;
                    font-size: 10pt;
                    font-weight: bold;
                }
                .serial-number-field span {
                    margin-right: 3mm;
                }
                .serial-input {
                    display: inline-block;
                    width: 50mm;
                    border-bottom: 1px solid #000;
                    height: 5mm;
                }
                
                /* Fecha de expediente */
                .expedition-container {
                    display: flex;
                    justify-content: flex-end;
                    margin-bottom: 4mm;
                    width: 100%;
                }
                .expedition-date {
                    display: flex;
                    align-items: center;
                    font-size: 10pt;
                }
                .expedition-date span {
                    font-weight: bold;
                    margin-right: 3mm;
                }
                .date-field {
                    width: 25mm;
                    border-bottom: 1px solid #000;
                    margin-right: 3mm;
                    height: 5mm;
                }
                .oval-rectangle {
                    display: inline-block;
                    padding: 1mm 3mm;
                    border: 1px solid #000;
                    border-radius: 6mm;
                    margin: 0 1mm;
                    min-width: 12mm;
                    text-align: center;
                    font-size: 9pt;
                }
                
                /* Datos de referencia */
                .reference-data {
                    margin-bottom: 4mm;
                    width: 100%;
                }
                .data-row {
                    display: flex;
                    margin-bottom: 2mm;
                    width: 100%;
                }
                .data-field {
                    flex: 1;
                }
                .underline {
                    border-bottom: 1px solid #000;
                    padding: 1mm 0;
                    min-height: 5mm;
                    font-size: 10pt;
                }
                
                /* Secciones de texto */
                .section {
                    margin: 3mm 0;
                    width: 100%;
                }
                .section-title {
                    font-weight: bold;
                    margin-bottom: 1mm;
                    font-size: 10pt;
                }
                .text-area {
                    width: 100%;
                    min-height: 15mm;
                    border: 1px solid #000;
                    border-radius: 2mm;
                    padding: 2mm;
                    font-size: 10pt;
                }
                
                /* Título centrado */
                .centered-title {
                    font-weight: bold;
                    text-align: center;
                    margin: 3mm 0;
                    font-size: 10pt;
                }
                
                /* Tabla de materiales */
                .materials-container {
                    border: 1px solid #000;
                    border-radius: 2mm;
                    overflow: hidden;
                    margin: 3mm 0;
                    width: 100%;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 8pt;
                }
                th, td {
                    border: 1px solid #000;
                    padding: 1mm;
                    text-align: center;
                    height: 5mm;
                }
                th {
                    font-weight: bold;
                }
                
                /* Pie de página con firmas */
                .footer-container {
                    display: flex;
                    justify-content: space-between;
                    margin-top: 5mm;
                    width: 100%;
                }
                .signatures-container {
                    display: flex;
                    justify-content: space-between;
                    width: 72%;
                    gap: 2mm;
                }
                .signature-box {
                    text-align: center;
                    flex: 1;
                    padding: 2mm;
                    border: 1px solid #000;
                    border-radius: 2mm;
                    display: flex;
                    flex-direction: column;
                    min-height: 25mm;
                }
                .signature-title {
                    font-weight: bold;
                    margin-bottom: 1mm;
                    font-size: 9pt;
                }
                .signature-line {
                    border-bottom: 1px solid #000;
                    flex-grow: 1;
                    margin: 2mm 0;
                }
                .signature-name {
                    font-size: 8pt;
                    line-height: 1.1;
                }
                .note-box {
                    font-weight: bold;
                    font-size: 7pt;
                    text-align: center;
                    padding: 2mm;
                    border: 1px solid #000;
                    border-radius: 2mm;
                    background-color: #f9f9f9;
                    width: 25%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                /* Estilos de impresión específicos */
                @media print {
                    body {
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 100% !important;
                    }
                    .service-order-container {
                        width: 180mm !important;
                        max-width: 180mm !important;
                        padding: 5mm !important;
                        margin: 0 auto !important;
                        box-shadow: none !important;
                        border: none !important;
                    }
                    /* Ocultar botones de acción */
                    .modal-actions, .close {
                        display: none !important;
                    }
                }
                
                /* Ajuste para móviles en navegador */
                @media screen and (max-width: 200mm) {
                    body {
                        padding: 2mm;
                    }
                    .service-order-container {
                        width: 100%;
                        max-width: 100%;
                        transform: scale(0.9);
                        transform-origin: top center;
                    }
                }
            </style>
        </head>
        <body>
            ${serviceOrderContent.innerHTML}
            <script>
                // Auto-imprimir y cerrar
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                        setTimeout(function() {
                            window.close();
                        }, 100);
                    }, 50);
                };
            <\/script>
        </body>
        </html>
    `;
    
    // Abrir ventana de impresión
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Por favor permite ventanas emergentes para imprimir la orden de servicio.');
        return;
    }
    
    printWindow.document.write(printHTML);
    printWindow.document.close();
}

// Función para mostrar/ocultar campo de área manual
function toggleCustomArea() {
    const select = document.getElementById('outputArea');
    const customInput = document.getElementById('customArea');
    
    if (select.value === 'OTRO') {
        customInput.style.display = 'block';
        customInput.required = true;
    } else {
        customInput.style.display = 'none';
        customInput.required = false;
    }
}

// Función para abrir modal de nueva área
function openAddAreaModal() {
    document.getElementById('newAreaName').value = '';
    document.getElementById('areaModal').style.display = 'block';
}

// Función para guardar nueva área
function saveNewArea() {
    const areaName = document.getElementById('newAreaName').value.trim();
    
    if (!areaName) {
        alert('Por favor ingrese un nombre para el área');
        return;
    }
    
    // Verificar si el área ya existe
    if (areas.some(a => a.name.toUpperCase() === areaName.toUpperCase())) {
        alert('Esta área ya existe');
        return;
    }
    
    const newArea = {
        id: Date.now().toString(),
        name: areaName.toUpperCase()
    };
    
    areasRef.child(newArea.id).set(newArea)
        .then(() => {
            alert('Área agregada correctamente');
            closeModal('areaModal');
        })
        .catch(error => {
            alert('Error al guardar el área: ' + error.message);
        });
}

// Cargar opciones de áreas
function loadAreaOptions() {
    const areaSelect = document.getElementById('outputArea');
    if (!areaSelect) return;
    
    const currentValue = areaSelect.value;
    
    // Limpiar manteniendo las opciones base
    while (areaSelect.options.length > 1) {
        areaSelect.remove(1);
    }
    
    // Eliminar duplicados
    const uniqueAreas = [...new Set(areas.map(a => a.name))];
    
    // Ordenar alfabéticamente
    uniqueAreas.sort((a, b) => a.localeCompare(b));
    
    // Agregar opción "Otro"
    const otherOption = document.createElement('option');
    otherOption.value = 'OTRO';
    otherOption.textContent = 'Otro (especificar)';
    areaSelect.add(otherOption);
    
    // Agregar opciones de áreas
    uniqueAreas.forEach(area => {
        const option = document.createElement('option');
        option.value = area;
        option.textContent = area;
        areaSelect.add(option);
    });
    
    // Restaurar valor seleccionado si existe
    if (currentValue && [...areaSelect.options].some(o => o.value === currentValue)) {
        areaSelect.value = currentValue;
        toggleCustomArea();
    }
}

// Función para mostrar/ocultar el campo de responsable manual
function toggleCustomResponsible() {
    const select = document.getElementById('entryResponsible');
    const customInput = document.getElementById('customResponsible');
    
    if (select.value === 'OTRO') {
        customInput.style.display = 'block';
        customInput.required = true;
    } else {
        customInput.style.display = 'none';
        customInput.required = false;
    }
}

// Mostrar/ocultar campo de ingeniero manual
function toggleCustomEngineer() {
    const select = document.getElementById('outputEngineer');
    const customInput = document.getElementById('customEngineer');
    if (select.value === 'OTRO') {
        customInput.style.display = 'block';
        customInput.required = true;
    } else {
        customInput.style.display = 'none';
        customInput.required = false;
    }
}

// Funciones para manejar las pestañas
function openTab(evt, tabName) {
    let tabcontent = document.getElementsByClassName("tab-content");
    for (let i = 0; i < tabcontent.length; i++) {
        tabcontent[i].className = tabcontent[i].className.replace(" active", "");
    }
    
    let tablinks = document.getElementsByClassName("tab");
    for (let i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
    
    document.getElementById(tabName).className += " active";
    evt.currentTarget.className += " active";
    
    if (tabName === 'inventory') {
        loadInventory();
    } else if (tabName === 'entries') {
        loadEntries();
    } else if (tabName === 'outputs') {
        loadOutputs();
    }
}

// Cargar inventario en la tabla
function loadInventory() {
    let tableBody = document.getElementById('inventoryTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    inventory.forEach(item => {
        let row = document.createElement('tr');
        
        if (item.stock <= item.minStock) {
            row.className = item.stock === 0 ? 'critical-stock' : 'low-stock';
        }
        
        row.innerHTML = `
            <td>${item.id}</td>
            <td>${item.name}</td>
            <td>${item.type}</td>
            <td>${item.brand || item.brands || 'N/A'}</td>
            <td>${item.model}</td>
            <td>${item.size}</td>
            <td>${item.stock}</td>
            <td>${item.minStock}</td>
            <td class="action-buttons">
                <button class="btn btn-primary" onclick="viewItemDetails('${item.id}')">Ver</button>
                <button class="btn btn-warning" onclick="editItem('${item.id}')">Editar</button>
                <button class="btn btn-success" onclick="generateItemQR('${item.id}')">QR</button>
                <button class="btn btn-danger" onclick="confirmDeleteItem('${item.id}')">Eliminar</button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

// Función para confirmar eliminación
function confirmDeleteItem(id) {
    if (confirm('¿Estás seguro que deseas eliminar este insumo permanentemente? Esta acción no se puede deshacer.')) {
        deleteItem(id);
    }
}

// Función para eliminar el insumo
function deleteItem(id) {
    inventoryRef.child(id).remove()
        .then(() => {
            // Eliminar entradas y salidas relacionadas
            entries.forEach(entry => {
                if (entry.itemId === id) {
                    entriesRef.child(entry.id).remove();
                }
            });
            
            outputs.forEach(output => {
                if (output.itemId === id) {
                    outputsRef.child(output.id).remove();
                }
            });
            
            alert('Insumo eliminado correctamente');
        })
        .catch(error => {
            alert('Error al eliminar el insumo: ' + error.message);
        });
}

// Buscar en el inventario
function searchInventory() {
    let input = document.getElementById('inventorySearch');
    let filter = input.value.toUpperCase();
    let table = document.getElementById('inventoryTable');
    if (!table) return;
    
    let tr = table.getElementsByTagName('tr');
    
    for (let i = 1; i < tr.length; i++) {
        let found = false;
        let td = tr[i].getElementsByTagName('td');
        
        for (let j = 0; j < td.length - 1; j++) {
            if (td[j] && td[j].innerHTML.toUpperCase().indexOf(filter) > -1) {
                found = true;
                break;
            }
        }
        
        tr[i].style.display = found ? "" : "none";
    }
}

// Filtro por tipo
function filterByType() {
    let type = document.getElementById('typeFilter').value;
    let table = document.getElementById('inventoryTable');
    if (!table) return;
    
    let tr = table.getElementsByTagName('tr');
    
    for (let i = 1; i < tr.length; i++) {
        let typeCell = tr[i].cells[2];
        if (type === 'all' || typeCell.textContent === type) {
            tr[i].style.display = "";
        } else {
            tr[i].style.display = "none";
        }
    }
}

// Cargar opciones de filtro por tipo
function loadTypeFilterOptions() {
    let typeFilter = document.getElementById('typeFilter');
    if (!typeFilter) return;
    
    while (typeFilter.options.length > 1) {
        typeFilter.remove(1);
    }
    
    let types = [...new Set(inventory.map(item => item.type))];
    types.forEach(type => {
        let option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        typeFilter.appendChild(option);
    });
}

// Verificar alertas de stock
function checkStockAlerts() {
    let alertsDiv = document.getElementById('stockAlerts');
    if (!alertsDiv) return;
    
    alertsDiv.innerHTML = '';
    
    let criticalItems = inventory.filter(item => item.stock === 0 && item.stock <= item.minStock);
    let lowItems = inventory.filter(item => item.stock > 0 && item.stock <= item.minStock);
    
    if (criticalItems.length > 0) {
        let alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-danger';
        alertDiv.innerHTML = `<strong>¡Stock crítico!</strong> Los siguientes insumos están agotados: ${criticalItems.map(item => item.name).join(', ')}.`;
        alertsDiv.appendChild(alertDiv);
    }
    
    if (lowItems.length > 0) {
        let alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-warning';
        alertDiv.innerHTML = `<strong>¡Stock bajo!</strong> Los siguientes insumos están por debajo del mínimo: ${lowItems.map(item => item.name).join(', ')}.`;
        alertsDiv.appendChild(alertDiv);
    }
}

// Manejo de tipos de insumos
function toggleCustomType() {
    let customTypeInput = document.getElementById('customType');
    if (document.getElementById('itemType').value === 'OTRO') {
        customTypeInput.style.display = 'block';
        customTypeInput.required = true;
    } else {
        customTypeInput.style.display = 'none';
        customTypeInput.required = false;
    }
}

function loadItemTypeOptions() {
    const typeSelect = document.getElementById('itemType');
    if (!typeSelect) return;
    
    const currentValue = typeSelect.value;
    
    // Limpiar manteniendo las primeras opciones fijas
    while (typeSelect.options.length > 2) {
        typeSelect.remove(2);
    }
    
    // Eliminar duplicados usando Set
    const uniqueTypes = [...new Set(itemTypes.map(t => t.name))];
    
    // Ordenar alfabéticamente
    uniqueTypes.sort((a, b) => a.localeCompare(b));
    
    // Agregar opciones
    uniqueTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        typeSelect.add(option);
    });
    
    // Restaurar valor seleccionado si existe
    if (currentValue && [...typeSelect.options].some(o => o.value === currentValue)) {
        typeSelect.value = currentValue;
    }
}

// Función para abrir el modal de nuevo tipo
function openAddTypeModal() {
    document.getElementById('newTypeName').value = '';
    document.getElementById('typeModal').style.display = 'block';
}

// Función para guardar un nuevo tipo
function saveNewType() {
    const typeName = document.getElementById('newTypeName').value.trim();
    
    if (!typeName) {
        alert('Por favor ingrese un nombre para el tipo');
        return;
    }
    
    // Verificar si el tipo ya existe
    if (itemTypes.some(t => t.name.toUpperCase() === typeName.toUpperCase())) {
        alert('Este tipo ya existe');
        return;
    }
    
    const newType = {
        id: Date.now().toString(),
        name: typeName.toUpperCase()
    };
    
    typesRef.child(newType.id).set(newType)
        .then(() => {
            alert('Tipo agregado correctamente');
            closeModal('typeModal');
        })
        .catch(error => {
            alert('Error al guardar el tipo: ' + error.message);
        });
}

// Función para mostrar/ocultar el campo de marca manual
function toggleCustomBrand() {
    const select = document.getElementById('itemBrand');
    const customInput = document.getElementById('customBrand');
    
    if (select.value === 'OTRO') {
        customInput.style.display = 'block';
        customInput.required = true;
    } else {
        customInput.style.display = 'none';
        customInput.required = false;
    }
}

// Función para abrir el modal de nueva marca
function openAddBrandModal() {
    document.getElementById('newBrandName').value = '';
    document.getElementById('brandModal').style.display = 'block';
}

// Función para guardar una nueva marca
function saveNewBrand() {
    const brandName = document.getElementById('newBrandName').value.trim();
    
    if (!brandName) {
        alert('Por favor ingrese un nombre para la marca');
        return;
    }
    
    // Verificar si la marca ya existe
    if (itemBrands.some(b => b.name.toUpperCase() === brandName.toUpperCase())) {
        alert('Esta marca ya existe');
        return;
    }
    
    const newBrand = {
        id: Date.now().toString(),
        name: brandName.toUpperCase()
    };
    
    brandsRef.child(newBrand.id).set(newBrand)
        .then(() => {
            alert('Marca agregada correctamente');
            closeModal('brandModal');
        })
        .catch(error => {
            alert('Error al guardar la marca: ' + error.message);
        });
}

// Cargar opciones de marcas en el selector
function loadItemBrandOptions() {
    const brandSelect = document.getElementById('itemBrand');
    if (!brandSelect) return;
    
    const currentValue = brandSelect.value;
    
    // Limpiar manteniendo las primeras opciones fijas
    while (brandSelect.options.length > 1) {
        brandSelect.remove(1);
    }
    
    // Eliminar duplicados usando Set
    const uniqueBrands = [...new Set(itemBrands.map(b => b.name))];
    
    // Ordenar alfabéticamente
    uniqueBrands.sort((a, b) => a.localeCompare(b));
    
    // Agregar opción "Otro"
    const otherOption = document.createElement('option');
    otherOption.value = 'OTRO';
    otherOption.textContent = 'Otro (especificar)';
    brandSelect.add(otherOption);
    
    // Agregar opciones de marcas
    uniqueBrands.forEach(brand => {
        const option = document.createElement('option');
        option.value = brand;
        option.textContent = brand;
        brandSelect.add(option);
    });
    
    // Restaurar valor seleccionado si existe
    if (currentValue && [...brandSelect.options].some(o => o.value === currentValue)) {
        brandSelect.value = currentValue;
        toggleCustomBrand();
    }
}

// Abrir modal para agregar insumo
function openAddItemModal() {
    document.getElementById('itemModalTitle').textContent = 'Agregar Nuevo Insumo';
    
    // Resetear el formulario
    document.getElementById('itemForm').reset();
    document.getElementById('itemId').value = '';
    
    // Limpiar marcas seleccionadas
    const selectedBrandsContainer = document.getElementById('selectedBrandsContainer');
    if (selectedBrandsContainer) {
        selectedBrandsContainer.innerHTML = '';
    }
    
    const itemBrandsInput = document.getElementById('itemBrands');
    if (itemBrandsInput) {
        itemBrandsInput.value = '';
    }
    
    // Ocultar campo de tipo personalizado
    document.getElementById('customType').style.display = 'none';
    document.getElementById('customType').required = false;
    
    document.getElementById('itemModal').style.display = 'block';
}

// Abrir modal para editar insumo
function editItem(id) {
    let item = inventory.find(i => i.id === id);
    if (!item) return;
    
    document.getElementById('itemModalTitle').textContent = 'Editar Insumo';
    document.getElementById('itemId').value = item.id;
    document.getElementById('itemNumber').value = item.id;
    document.getElementById('itemName').value = item.name;
    
    let typeSelect = document.getElementById('itemType');
    typeSelect.value = item.type;
    toggleCustomType();
    
    document.getElementById('itemVoucher').value = item.voucher;
    document.getElementById('itemCharacteristic').value = item.characteristic;
    
    // Cargar marcas (puede ser string o array) - COMPATIBILIDAD CON DATOS ANTIGUOS Y NUEVOS
    if (item.brands) {
        // Nuevo sistema: múltiples marcas en campo "brands"
        if (Array.isArray(item.brands)) {
            // Si es un array, unir con comas
            loadSelectedBrands(item.brands.join(','));
        } else {
            // Si es string, usar directamente
            loadSelectedBrands(item.brands);
        }
    } else if (item.brand) {
        // Sistema antiguo: marca única en campo "brand"
        loadSelectedBrands(item.brand);
    } else {
        // Limpiar si no hay marcas
        const selectedBrandsContainer = document.getElementById('selectedBrandsContainer');
        if (selectedBrandsContainer) {
            selectedBrandsContainer.innerHTML = '';
        }
        const itemBrandsInput = document.getElementById('itemBrands');
        if (itemBrandsInput) {
            itemBrandsInput.value = '';
        }
    }
    
    document.getElementById('itemModel').value = item.model;
    document.getElementById('itemSize').value = item.size;
    document.getElementById('itemInitialStock').value = item.stock;
    document.getElementById('itemMinStock').value = item.minStock;
    
    if (item.expiration) {
        document.getElementById('itemExpiration').value = new Date(item.expiration).toISOString().split('T')[0];
    } else {
        document.getElementById('itemExpiration').value = '';
    }
    
    document.getElementById('itemModal').style.display = 'block';
}

// Guardar insumo (nuevo o editado) - CON VALIDACIÓN DE ID DUPLICADO
function saveItem() {
    let id = document.getElementById('itemId').value;
    let itemNumber = document.getElementById('itemNumber').value;
    let itemName = document.getElementById('itemName').value;
    let itemType = document.getElementById('itemType').value;
    let customType = document.getElementById('customType').value;
    let itemVoucher = document.getElementById('itemVoucher').value;
    let itemCharacteristic = document.getElementById('itemCharacteristic').value;
    
    // Obtener marcas seleccionadas (ahora es una lista)
    let itemBrandsValue = document.getElementById('itemBrands').value;
    
    let itemModel = document.getElementById('itemModel').value;
    let itemSize = document.getElementById('itemSize').value;
    let itemInitialStock = parseInt(document.getElementById('itemInitialStock').value);
    let itemMinStock = parseInt(document.getElementById('itemMinStock').value);
    let itemExpiration = document.getElementById('itemExpiration').value;

    // Resetear el tipo si es "Europea" (caso especial)
    if (document.getElementById('itemType').value === "Europea" && !customType) {
        document.getElementById('itemType').value = "";
    }
  
    // Manejo de tipos personalizados
    if (itemType === 'OTRO' && customType) {
        itemType = customType.toUpperCase();
        // Verificar si el tipo ya existe
        if (!itemTypes.some(t => t.name.toUpperCase() === itemType)) {
            const newType = { id: Date.now().toString(), name: itemType };
            typesRef.child(newType.id).set(newType);
        }
    } else if (!itemType) {
        alert('Seleccione un tipo de insumo');
        return;
    }
        
    // Validaciones
    if (!itemNumber || !itemName || !itemType || isNaN(itemInitialStock) || isNaN(itemMinStock)) {
        alert('Por favor complete todos los campos requeridos');
        return;
    }
    
    if (itemInitialStock < 0 || itemMinStock < 1) {
        alert('El stock inicial no puede ser negativo y el stock mínimo debe ser al menos 1');
        return;
    }
    
    // VALIDACIÓN DE ID DUPLICADO (solo para nuevos insumos)
    if (!id) { // Si es un nuevo insumo (no edición)
        const existingItem = inventory.find(item => item.id === itemNumber);
        if (existingItem) {
            alert('❌ Error: Ya existe un insumo con este ID. Por favor, utilice un ID único.');
            
            // Resaltar el campo de ID
            const idInput = document.getElementById('itemNumber');
            idInput.style.borderColor = 'red';
            idInput.style.boxShadow = '0 0 0 2px rgba(239, 68, 68, 0.2)';
            idInput.focus();
            
            return;
        }
    }
    
    // Preparar datos del insumo
    let itemData = {
        id: itemNumber,
        name: itemName,
        type: itemType,
        voucher: itemVoucher,
        characteristic: itemCharacteristic,
        brands: itemBrandsValue,  // Ahora guardamos múltiples marcas
        model: itemModel,
        size: itemSize,
        stock: itemInitialStock,
        minStock: itemMinStock,
        expiration: itemExpiration ? new Date(itemExpiration).toISOString() : null
    };
    
    // Guardar en Firebase
    if (id) {
        // Actualizar existente
        inventoryRef.child(id).update(itemData)
            .then(() => {
                alert('Insumo actualizado correctamente');
                closeModal('itemModal');
            })
            .catch(error => {
                alert('Error al actualizar: ' + error.message);
            });
    } else {
        // Crear nuevo
        inventoryRef.child(itemNumber).set(itemData)
            .then(() => {
                alert('Insumo agregado correctamente');
                closeModal('itemModal');
            })
            .catch(error => {
                alert('Error al guardar: ' + error.message);
            });
    }
}

// Generar código QR para un insumo
function generateItemQR(id) {
    let item = inventory.find(i => i.id === id);
    if (!item) return;
    
    let qr = qrcode(0, 'L');
    let qrData = `INSUMO:${item.id}|${item.name}|${item.type}|${item.brand}|${item.model}`;
    qr.addData(qrData);
    qr.make();
    
    document.getElementById('qrCode').innerHTML = qr.createImgTag(4);
    document.getElementById('qrModalTitle').textContent = `Código QR - ${item.name}`;
    
    document.getElementById('qrItemInfo').innerHTML = `
        <p><strong>ID:</strong> ${item.id}</p>
        <p><strong>Nombre:</strong> ${item.name}</p>
        <p><strong>Tipo:</strong> ${item.type}</p>
        <p><strong>Marca:</strong> ${item.brand}</p>
        <p><strong>Modelo:</strong> ${item.model}</p>
    `;
    
    document.getElementById('qrModal').style.display = 'block';
}

// Imprimir código QR
// Modifica las funciones de impresión existentes
// ===== FUNCIÓN MEJORADA PARA IMPRIMIR QR =====
function printQR() {
    const qrCode = document.getElementById('qrCode').innerHTML;
    const qrInfo = document.getElementById('qrItemInfo').innerHTML;
    
    const cleanHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Código QR</title>
            <meta charset="UTF-8">
            <style>
                @page { margin: 0 !important; }
                body { 
                    margin: 0 !important; 
                    padding: 10mm !important; 
                    text-align: center;
                    font-family: Arial, sans-serif;
                }
                img { max-width: 200px; height: auto; }
            </style>
        </head>
        <body onload="window.print(); setTimeout(function() { window.close(); }, 100);">
            ${qrCode}
            ${qrInfo}
        </body>
        </html>
    `;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(cleanHtml);
    printWindow.document.close();
}
// Ver detalles del insumo
function viewItemDetails(id) {
    let item = inventory.find(i => i.id === id);
    if (!item) return;
    
    document.getElementById('detailsModalTitle').textContent = `Detalles - ${item.name}`;
    
    let detailsHTML = `
        <p><strong>ID:</strong> ${item.id}</p>
        <p><strong>Nombre:</strong> ${item.name}</p>
        <p><strong>Tipo:</strong> ${item.type}</p>
        <p><strong>Folio Vale:</strong> ${item.voucher}</p>
        <p><strong>Característica:</strong> ${item.characteristic}</p>
        <p><strong>Marca Compatible:</strong> ${item.brand}</p>
        <p><strong>Modelo Compatible:</strong> ${item.model}</p>
        <p><strong>Tamaño:</strong> ${item.size}</p>
        <p><strong>Existencias:</strong> ${item.stock}</p>
        <p><strong>Stock Mínimo:</strong> ${item.minStock}</p>
    `;
    
    if (item.expiration) {
        detailsHTML += `<p><strong>Fecha de Caducidad:</strong> ${new Date(item.expiration).toLocaleDateString()}</p>`;
    }
    
    document.getElementById('itemDetails').innerHTML = detailsHTML;
    
    let movementsBody = document.getElementById('movementsTableBody');
    movementsBody.innerHTML = '';
    
    // Filtrar movimientos para este item
    let itemEntries = entries.filter(entry => entry.itemId === id);
    let itemOutputs = outputs.filter(output => output.itemId === id);
    
    itemEntries.forEach(entry => {
        let row = document.createElement('tr');
        row.innerHTML = `
            <td>${new Date(entry.date).toLocaleDateString()}</td>
            <td>Entrada</td>
            <td>+${entry.quantity}</td>
            <td>Vale: ${entry.voucher}</td>
            <td>N/A</td>
        `;
        movementsBody.appendChild(row);
    });
    
    itemOutputs.forEach(output => {
        let row = document.createElement('tr');
        row.className = output.movementType === 'loan' ? 'loan-row' : '';
        row.innerHTML = `
            <td>${new Date(output.date).toLocaleDateString()}</td>
            <td>${output.movementType === 'loan' ? 'Préstamo' : 'Salida'}</td>
            <td>-${output.quantity}</td>
            <td>OS: ${output.os}</td>
            <td>${output.engineer}</td>
        `;
        movementsBody.appendChild(row);
    });
    
    document.getElementById('detailsModal').style.display = 'block';
}

// Cargar opciones de insumos en los selects
function loadItemOptions() {
    let entryItemSelect = document.getElementById('entryItem');
    let outputItemSelect = document.getElementById('outputItem');
    
    if (!entryItemSelect || !outputItemSelect) return;
    
    while (entryItemSelect.options.length > 1) {
        entryItemSelect.remove(1);
    }
    
    while (outputItemSelect.options.length > 1) {
        outputItemSelect.remove(1);
    }
    
    inventory.forEach(item => {
        let option = document.createElement('option');
        option.value = item.id;
        option.textContent = `${item.id} - ${item.name}`;
        
        entryItemSelect.appendChild(option.cloneNode(true));
        outputItemSelect.appendChild(option.cloneNode(true));
    });
}

function restoreEntryFormFields() {
    const entryForm = document.getElementById('entryForm');
    const inputs = entryForm.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
        input.removeAttribute('readonly');
        input.removeAttribute('disabled');
        input.style.backgroundColor = '';
        input.style.borderColor = '';
    });
    
    // Especialmente importante para el campo de factura
    document.getElementById('entryInvoice').removeAttribute('readonly');
    document.getElementById('entryInvoice').style.backgroundColor = '';
    document.getElementById('entryInvoice').style.borderColor = '';
    
    // Ocultar botón de edición de factura
    document.getElementById('editInvoiceButton').style.display = 'none';
}

function openAddEntryModal() {
    document.getElementById('entryModalTitle').textContent = 'Registrar Nueva Entrada';
    document.getElementById('entryForm').reset();
    
    // Limpiar lista de insumos
    selectedEntryItems = [];
    updateEntryItemsDisplay();
    
    // Generar folio automático
    document.getElementById('entryVoucher').value = generateNextFolio();
    
    // Establecer fecha actual
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];
    document.getElementById('entryDate').value = formattedDate;
    
    // Resetear responsable
    document.getElementById('customResponsible').style.display = 'none';
    document.getElementById('customResponsible').required = false;
    
    // Resetear sección de caducidades
    document.getElementById('expirationDatesContainer').innerHTML = '';
    document.getElementById('expirationSection').style.display = 'none';
    
    // Mostrar campo de cantidad inicialmente
    document.getElementById('entryQuantity').style.display = 'block';
    document.getElementById('entryQuantity').parentElement.style.display = 'block';
    document.getElementById('entryQuantity').value = '';
    document.getElementById('entryQuantity').disabled = false;
    
    // Configurar campo de factura
    document.getElementById('entryInvoice').removeAttribute('readonly');
    document.getElementById('entryInvoice').style.backgroundColor = '';
    document.getElementById('entryInvoice').style.borderColor = '';
    document.getElementById('editInvoiceButton').style.display = 'none';
    
    // Resetear estado de edición
    editingEntryId = null;
    
    // Mostrar modal
    document.getElementById('entryModal').style.display = 'block';
}

// Buscar en entradas
function searchEntries() {
    let input = document.getElementById('entriesSearch');
    let filter = input.value.toUpperCase();
    let table = document.getElementById('entriesTable');
    if (!table) return;
    
    let tr = table.getElementsByTagName('tr');
    
    for (let i = 1; i < tr.length; i++) {
        let found = false;
        let td = tr[i].getElementsByTagName('td');
        
        for (let j = 0; j < td.length - 1; j++) {
            if (td[j] && td[j].innerHTML.toUpperCase().indexOf(filter) > -1) {
                found = true;
                break;
            }
        }
        
        tr[i].style.display = found ? "" : "none";
    }
}

// Guardar entrada - VERSIÓN CORREGIDA
function saveEntry() {
    // Validar que haya al menos un insumo
    if (selectedEntryItems.length === 0) {
        alert('Debe agregar al menos un insumo');
        return;
    }
    
    // Obtener valores del formulario
    const voucher = document.getElementById('entryVoucher').value;
    const invoice = document.getElementById('entryInvoice').value;
    const comments = document.getElementById('entryComments').value;
    const date = document.getElementById('entryDate').value;
    
    // Manejo del responsable (selección o manual)
    let responsible = document.getElementById('entryResponsible').value;
    if (responsible === 'OTRO') {
        responsible = document.getElementById('customResponsible').value.trim();
        if (!responsible) {
            alert('Por favor ingrese el nombre del responsable');
            return;
        }
    }
    
    // Validaciones básicas
    if (!voucher || !date || !responsible) {
        alert('Complete los campos requeridos (*)');
        return;
    }
    
    // VERIFICAR FOLIO DUPLICADO (solo para nuevas entradas)
    if (!editingEntryId) {
        const folioExists = entries.some(entry => entry.voucher === voucher) || 
                           outputs.some(output => output.os === voucher);
        
        if (folioExists) {
            alert('❌ Error: Este número de folio ya existe en el sistema. No se puede registrar duplicados.');
            return;
        }
    }
    
    // Guardar cada insumo como entrada separada (pero con el mismo folio de vale)
    const promises = [];
    
    selectedEntryItems.forEach(item => {
        const entryId = editingEntryId ? editingEntryId : Date.now().toString() + '-' + item.id;
        
        const entry = {
            id: entryId,
            itemId: item.id,
            voucher: voucher,
            invoice: invoice || null,
            quantity: item.quantity,
            responsible: responsible,
            comments: comments || null,
            date: date + 'T00:00:00',
            isCustomResponsible: document.getElementById('entryResponsible').value === 'OTRO'
        };
        
        // Guardar en Firebase
        promises.push(
            entriesRef.child(entryId).set(entry)
                .then(() => {
                    // Actualizar stock solo para nuevas entradas
                    if (!editingEntryId) {
                        const inventoryItem = inventory.find(i => i.id === item.id);
                        if (inventoryItem) {
                            const newStock = inventoryItem.stock + item.quantity;
                            return inventoryRef.child(item.id).update({ stock: newStock });
                        }
                    }
                })
        );
    });

    // Ejecutar todas las operaciones
    Promise.all(promises)
        .then(() => {
            // Mostrar orden de servicio solo si es una nueva entrada
            if (!editingEntryId && selectedEntryItems.length > 0) {
                const firstItem = selectedEntryItems[0];
                const item = inventory.find(i => i.id === firstItem.id);
                
                showServiceOrder('entry', {
                    voucher: voucher,
                    quantity: firstItem.quantity,
                    responsible: responsible,
                    itemId: firstItem.id,
                    itemName: item ? item.name : 'Desconocido'
                });
            }
            
            closeModal('entryModal');
            showToast(editingEntryId ? '✅ Entrada actualizada correctamente' : '✅ Entrada registrada correctamente');
            
            // Limpiar para la próxima vez
            editingEntryId = null;
            selectedEntryItems = [];
            updateEntryItemsDisplay();
        })
        .catch(error => {
            alert('Error al guardar entrada: ' + error.message);
        });
}

// Función para editar número de factura
function editInvoiceNumber() {
    const invoiceInput = document.getElementById('entryInvoice');
    const isReadOnly = invoiceInput.hasAttribute('readonly');
    
    if (isReadOnly) {
        invoiceInput.removeAttribute('readonly');
        invoiceInput.style.backgroundColor = '#ffffe0';
        invoiceInput.style.borderColor = '#f59e0b';
        showToast('🔓 Modo edición activado para N° Factura');
    } else {
        invoiceInput.setAttribute('readonly', 'true');
        invoiceInput.style.backgroundColor = '';
        invoiceInput.style.borderColor = '';
        showToast('🔒 Modo edición desactivado');
    }
}

// Función para actualizar cantidades máximas
function updateExpirationQuantities() {
    const totalQuantity = parseInt(document.getElementById('entryQuantity').value) || 0;
    const quantityInputs = document.querySelectorAll('.expiration-quantity-input');
    const remainingQuantity = document.getElementById('remainingQuantity');
    
    let assignedQuantity = 0;
    quantityInputs.forEach(input => {
        assignedQuantity += parseInt(input.value) || 0;
    });
    
    const availableQuantity = totalQuantity - assignedQuantity;
    
    // Actualizar cantidades máximas permitidas
    quantityInputs.forEach(input => {
        const currentValue = parseInt(input.value) || 0;
        input.max = currentValue + availableQuantity;
    });
    
    // Mostrar cantidad restante con colores según el estado
    if (availableQuantity === 0) {
        remainingQuantity.innerHTML = 
            `<span class="quantity-success">✓ Cantidad completa: ${assignedQuantity} de ${totalQuantity}</span>`;
    } else if (availableQuantity > 0) {
        remainingQuantity.innerHTML = 
            `Cantidad asignada: ${assignedQuantity} / ${totalQuantity} | <span class="quantity-warning">Restante: ${availableQuantity}</span>`;
    } else {
        remainingQuantity.innerHTML = 
            `<span class="quantity-warning">❌ Exceso: ${-availableQuantity} unidades de más</span>`;
    }
    
    // Habilitar o deshabilitar el botón de agregar según haya cantidad disponible
    const addButton = document.querySelector('.add-expiration-btn');
    if (addButton) {
        addButton.disabled = availableQuantity <= 0;
    }
}

// Función para agregar fecha de caducidad
function addExpirationDate() {
    const container = document.getElementById('expirationDatesContainer');
    const totalQuantity = parseInt(document.getElementById('entryQuantity').value) || 0;
    
    if (totalQuantity <= 0) {
        alert('Primero ingrese la cantidad total');
        return;
    }
    
    const dateRow = document.createElement('div');
    dateRow.className = 'expiration-date-row';
    
    dateRow.innerHTML = `
        <input type="date" class="expiration-date-input" required>
        <input type="number" class="expiration-quantity-input" min="1" 
               placeholder="Cantidad" required oninput="updateExpirationQuantities()">
        <button type="button" class="btn btn-danger" onclick="removeExpirationDate(this)" 
                style="padding: 0.5rem; width: auto;">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(dateRow);
    
    // Agregar event listener para la fecha también
    const dateInput = dateRow.querySelector('.expiration-date-input');
    dateInput.addEventListener('change', updateExpirationQuantities);
    
    // Enfocar el campo de cantidad
    const quantityInput = dateRow.querySelector('.expiration-quantity-input');
    quantityInput.focus();
    
    // Actualizar cantidades
    updateExpirationQuantities();
}

// Función para eliminar fecha de caducidad
function removeExpirationDate(button) {
    const row = button.parentElement;
    row.remove();
    updateExpirationQuantities();
}

// Función para validar fechas de caducidad
function validateExpirationDates() {
    const totalQuantity = parseInt(document.getElementById('entryQuantity').value) || 0;
    const quantityInputs = document.querySelectorAll('.expiration-quantity-input');
    
    let assignedQuantity = 0;
    quantityInputs.forEach(input => {
        assignedQuantity += parseInt(input.value) || 0;
    });
    
    if (assignedQuantity !== totalQuantity) {
        alert(`❌ La suma de las cantidades (${assignedQuantity}) debe ser igual a la cantidad total (${totalQuantity})`);
        return false;
    }
    
    // Validar fechas únicas
    const dateInputs = document.querySelectorAll('.expiration-date-input');
    const dates = [];
    
    dateInputs.forEach(input => {
        if (input.value) {
            dates.push(input.value);
        }
    });
    
    const uniqueDates = [...new Set(dates)];
    if (dates.length !== uniqueDates.length) {
        alert('❌ No puede haber fechas de caducidad duplicadas');
        return false;
    }
    
    return true;
}

// Función para obtener las fechas de caducidad
function getExpirationDates() {
    const dateInputs = document.querySelectorAll('.expiration-date-input');
    const quantityInputs = document.querySelectorAll('.expiration-quantity-input');
    const expirationData = [];
    
    dateInputs.forEach((input, index) => {
        if (input.value && quantityInputs[index].value) {
            expirationData.push({
                date: input.value,
                quantity: parseInt(quantityInputs[index].value)
            });
        }
    });
    
    return expirationData;
}

// Función para cargar fechas de caducidad existentes
function loadExpirationDates(expirationData, readOnly = false) {
    const container = document.getElementById('expirationDatesContainer');
    container.innerHTML = '';
    
    if (expirationData && expirationData.length > 0) {
        expirationData.forEach(item => {
            const dateRow = document.createElement('div');
            dateRow.className = 'expiration-date-row';
            dateRow.style.display = 'flex';
            dateRow.style.gap = '0.5rem';
            dateRow.style.marginBottom = '0.5rem';
            dateRow.style.alignItems = 'center';
            
            if (readOnly) {
                // Modo solo lectura para edición
                dateRow.innerHTML = `
                    <input type="date" class="expiration-date-input" value="${item.date}" style="flex: 2;" readonly>
                    <input type="number" class="expiration-quantity-input" value="${item.quantity}" style="flex: 1;" readonly>
                    <span style="color: var(--gray); font-size: 0.9rem;">Cantidad: ${item.quantity}</span>
                `;
            } else {
                // Modo editable para nuevas entradas
                dateRow.innerHTML = `
                    <input type="date" class="expiration-date-input" value="${item.date}" style="flex: 2;">
                    <input type="number" class="expiration-quantity-input" value="${item.quantity}" min="1" placeholder="Cantidad" style="flex: 1;">
                    <button type="button" class="btn btn-danger" onclick="removeExpirationDate(this)" style="width: auto;">
                        <i class="fas fa-times"></i>
                    </button>
                `;
                
                // Agregar event listeners para actualizar cantidades
                const dateInput = dateRow.querySelector('.expiration-date-input');
                const quantityInput = dateRow.querySelector('.expiration-quantity-input');
                
                dateInput.addEventListener('change', updateExpirationQuantities);
                quantityInput.addEventListener('input', updateExpirationQuantities);
            }
            
            container.appendChild(dateRow);
        });
        
        document.getElementById('expirationSection').style.display = 'block';
        if (!readOnly) {
            updateExpirationQuantities();
        }
    }
}

// Función para verificar si el item seleccionado tiene fecha de caducidad
function checkItemExpiration() {
    const itemId = document.getElementById('entryItem').value;
    const expirationSection = document.getElementById('expirationSection');
    
    if (itemId) {
        const item = inventory.find(i => i.id === itemId);
        if (item && item.expiration) {
            expirationSection.style.display = 'block';
            
            // Mostrar mensaje informativo
            const remainingDiv = document.getElementById('remainingQuantity');
            if (remainingDiv && !remainingDiv.textContent) {
                remainingDiv.textContent = 'Este insumo requiere control de caducidad. Agregue las fechas correspondientes.';
            }
        } else {
            expirationSection.style.display = 'block'; // Mostrar siempre pero con mensaje diferente
            document.getElementById('remainingQuantity').textContent = 'Este insumo no requiere control de caducidad.';
        }
    }
}

// Función para editar entrada existente (SOLO número de factura)
function editEntry(id) {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    
    editingEntryId = id;
    
    document.getElementById('entryModalTitle').textContent = 'Editar N° Factura de Entrada';
    document.getElementById('entryForm').reset();
    
    // Primero, restaurar todos los campos
    restoreEntryFormFields();
    
    // Llenar campos del formulario pero hacerlos readonly excepto factura
    document.getElementById('entryVoucher').value = entry.voucher;
    document.getElementById('entryInvoice').value = entry.invoice || '';
    document.getElementById('entryQuantity').value = entry.quantity;
    document.getElementById('entryComments').value = entry.comments || '';
    document.getElementById('entryDate').value = entry.date.split('T')[0];
    
    // Seleccionar el item
    document.getElementById('entryItem').value = entry.itemId;
    
    // Seleccionar responsable
    if (entry.isCustomResponsible) {
        document.getElementById('entryResponsible').value = 'OTRO';
        document.getElementById('customResponsible').value = entry.responsible;
        document.getElementById('customResponsible').style.display = 'block';
    } else {
        document.getElementById('entryResponsible').value = entry.responsible;
        document.getElementById('customResponsible').style.display = 'none';
    }
    
    // Hacer todos los campos readonly excepto factura
    document.getElementById('entryVoucher').setAttribute('readonly', true);
    document.getElementById('entryQuantity').setAttribute('readonly', true);
    document.getElementById('entryComments').setAttribute('readonly', true);
    document.getElementById('entryDate').setAttribute('readonly', true);
    document.getElementById('entryItem').setAttribute('disabled', true);
    document.getElementById('entryResponsible').setAttribute('disabled', true);
    document.getElementById('customResponsible').setAttribute('readonly', true);
    
    // Mostrar botón de editar factura
    document.getElementById('editInvoiceButton').style.display = 'block';
    
    // Hacer el campo de factura readonly inicialmente
    document.getElementById('entryInvoice').setAttribute('readonly', true);
    document.getElementById('entryInvoice').style.backgroundColor = '#f8fafc';
    document.getElementById('entryInvoice').style.borderColor = '#e2e8f0';
    
    // Cargar fechas de caducidad si existen (solo visualización)
    if (entry.expirationData && entry.expirationData.length > 0) {
        loadExpirationDates(entry.expirationData, true); // true = modo solo lectura
    } else {
        document.getElementById('expirationDatesContainer').innerHTML = '';
        document.getElementById('expirationSection').style.display = 'none';
    }
    
    // Verificar si el item tiene fecha de caducidad para mostrar la sección
    const item = inventory.find(i => i.id === entry.itemId);
    if (item && item.expiration) {
        document.getElementById('expirationSection').style.display = 'block';
    }
    
    document.getElementById('entryModal').style.display = 'block';
}

function viewEntryDetails(id) {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;

    const item = inventory.find(i => i.id === entry.itemId) || { name: "Desconocido" };
    
    // Mostrar la orden de servicio con botón de editar
    showServiceOrder('entry', {
        voucher: entry.voucher || 'N/A',
        quantity: entry.quantity,
        responsible: entry.responsible || 'N/A',
        itemId: entry.itemId,
        itemName: item.name,
        date: entry.date || new Date().toISOString(),
        entryId: id // Pasar el ID para editar
    });
}

// Cargar entradas en la tabla
function loadEntries() {
    let tableBody = document.getElementById('entriesTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    entries.forEach(entry => {
        let item = inventory.find(i => i.id === entry.itemId) || { name: "Insumo no encontrado" };

        // Formatear fecha correctamente (dd/mm/aaaa)
        let entryDate = 'N/A';
        if (entry.date) {
            const dateObj = new Date(entry.date);
            if (!isNaN(dateObj.getTime())) {
                entryDate = dateObj.toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                });
            }
        }

        let row = document.createElement('tr');
        row.innerHTML = `
            <td>${entry.voucher || 'N/A'}</td>
            <td>${item.name}</td>
            <td>${entry.quantity}</td>
            <td>${entry.responsible || 'N/A'}</td>
            <td>${entryDate}</td>
            <td class="action-buttons">
                <button class="btn btn-primary" onclick="viewEntryDetails('${entry.id}')">
                    <i class="fas fa-eye"></i> Ver
                </button>
                <button class="btn btn-warning" onclick="editEntry('${entry.id}')">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button class="btn btn-danger" onclick="verifyPasswordBeforeDelete('deleteEntry', '${entry.id}')">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function openAddOutputModal() {
    document.getElementById('outputModalTitle').textContent = 'Registrar Salida';
    document.getElementById('outputForm').reset();
    
    // Resetear lista de insumos
    selectedOutputItems = [];
    updateOutputItemsDisplay();
    
    // Generar folio automático para OS
    document.getElementById('outputOS').value = generateNextFolio();
    document.getElementById('outputOS').setAttribute('readonly', 'true');
    
    // Agregar botón para hacer editable
    const osField = document.getElementById('outputOS').parentElement;
    if (!osField.querySelector('.edit-os-btn')) {
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'btn btn-info edit-os-btn';
        editBtn.innerHTML = '<i class="fas fa-edit"></i> Editar Folio';
        editBtn.onclick = makeOutputOSEditable;
        editBtn.style.marginTop = '0.5rem';
        editBtn.style.width = '100%';
        osField.appendChild(editBtn);
    }
    
    document.getElementById('outputDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('customEngineer').style.display = 'none';
    document.getElementById('customArea').style.display = 'none';
    document.getElementById('outputModal').style.display = 'block';
    updateAvailableStock();
}

// Actualizar stock disponible al seleccionar un insumo
function updateAvailableStock() {
    let itemId = document.getElementById('outputItem').value;
    if (!itemId) {
        document.getElementById('availableStock').value = '';
        return;
    }
    
    let item = inventory.find(i => i.id === itemId);
    if (item) {
        document.getElementById('availableStock').value = item.stock;
    } else {
        document.getElementById('availableStock').value = '0';
    }
}

// Buscar en salidas
function searchOutputs() {
    let input = document.getElementById('outputsSearch');
    let filter = input.value.toUpperCase();
    let table = document.getElementById('outputsTable');
    if (!table) return;
    
    let tr = table.getElementsByTagName('tr');
    
    for (let i = 1; i < tr.length; i++) {
        let found = false;
        let td = tr[i].getElementsByTagName('td');
        
        for (let j = 0; j < td.length - 1; j++) {
            if (td[j] && td[j].innerHTML.toUpperCase().indexOf(filter) > -1) {
                found = true;
                break;
            }
        }
        
        tr[i].style.display = found ? "" : "none";
    }
}

// Guardar salida
function saveOutput() {
    const os = document.getElementById('outputOS').value;
    let engineer = document.getElementById('outputEngineer').value;
    const date = document.getElementById('outputDate').value;
    const movementType = document.getElementById('movementType').value;
    
    // Nuevos campos
    let area = document.getElementById('outputArea').value;
    const comments = document.getElementById('outputComments').value;

    // Validaciones básicas
    if (!os || !engineer || !area || selectedOutputItems.length === 0 || !date) {
        alert('Complete los campos requeridos');
        return;
    }

    // Validar área manual
    if (area === 'OTRO') {
        area = document.getElementById('customArea').value.trim();
        if (!area) {
            alert('Por favor ingrese el nombre del área');
            return;
        }
    }

    // Validar ingeniero manual
    if (engineer === 'OTRO') {
        engineer = document.getElementById('customEngineer').value.trim();
        if (!engineer) {
            alert('Por favor ingrese el nombre del ingeniero');
            return;
        }
    }

    // VERIFICAR FOLIO DUPLICADO (solo para nuevas salidas)
    if (!editingOutputId) {
        const folioExists = entries.some(entry => entry.voucher === os) || 
                           outputs.some(output => output.os === os);
        
        if (folioExists) {
            alert('❌ Error: Este número de folio ya existe en el sistema.');
            return;
        }
    }

    // Validar stock para cada insumo
    for (const item of selectedOutputItems) {
        const inventoryItem = inventory.find(i => i.id === item.id);
        if (!inventoryItem) {
            alert(`Insumo ${item.name} no encontrado en el inventario`);
            return;
        }
        
        if (inventoryItem.stock < item.quantity) {
            alert(`Stock insuficiente para ${item.name}. Disponible: ${inventoryItem.stock}, Solicitado: ${item.quantity}`);
            return;
        }
    }

    // Si estamos editando, primero restaurar el stock del registro original
    if (editingOutputId) {
        const originalOutput = outputs.find(o => o.id === editingOutputId);
        if (originalOutput) {
            const originalItem = inventory.find(i => i.id === originalOutput.itemId);
            if (originalItem) {
                // Restaurar stock
                inventoryRef.child(originalOutput.itemId).update({ 
                    stock: originalItem.stock + originalOutput.quantity 
                });
            }
        }
    }

    // Guardar cada insumo como salida separada (pero con el mismo folio OS)
    const promises = [];
    
    selectedOutputItems.forEach(item => {
        const outputId = editingOutputId ? editingOutputId : Date.now().toString() + '-' + item.id;
        const output = {
            id: outputId,
            itemId: item.id,
            os: os,
            engineer: engineer,
            quantity: item.quantity,
            date: date + 'T00:00:00',
            movementType: movementType,
            status: movementType === 'loan' ? 'pending' : 'completed',
            isCustomEngineer: document.getElementById('outputEngineer').value === 'OTRO',
            area: area,
            isCustomArea: document.getElementById('outputArea').value === 'OTRO',
            comments: comments || null,
            parentOutputId: editingOutputId || outputId // Para agrupar salidas relacionadas
        };

        // Guardar en Firebase
        promises.push(
            outputsRef.child(outputId).set(output)
                .then(() => {
                    // Actualizar stock
                    const inventoryItem = inventory.find(i => i.id === item.id);
                    if (inventoryItem) {
                        const newStock = inventoryItem.stock - item.quantity;
                        return inventoryRef.child(item.id).update({ stock: newStock });
                    }
                })
        );
    });

    // Ejecutar todas las operaciones
    Promise.all(promises)
        .then(() => {
            // Mostrar orden de servicio solo si es una nueva salida
            if (!editingOutputId) {
                const firstItem = selectedOutputItems[0];
                const item = inventory.find(i => i.id === firstItem.id);
                
                showServiceOrder('output', {
                    os: os,
                    quantity: firstItem.quantity,
                    engineer: engineer,
                    area: area,
                    movementType: movementType,
                    itemId: firstItem.id,
                    itemName: item ? item.name : 'Desconocido'
                });
            }
            
            closeModal('outputModal');
            showToast(editingOutputId ? '✅ Salida actualizada correctamente' : '✅ Salida registrada correctamente');
            
            // Limpiar para la próxima vez
            editingOutputId = null;
            selectedOutputItems = [];
        })
        .catch(error => {
            alert('Error al guardar: ' + error.message);
        });
}

// Ver detalles de salida - NUEVA VERSIÓN CON FORMATO DE ORDEN DE SERVICIO
function viewOutputDetails(id) {
    const output = outputs.find(o => o.id === id);
    if (!output) return;

    const item = inventory.find(i => i.id === output.itemId) || { name: "Desconocido" };
    
    // Formatear fecha correctamente para la orden de servicio
    const outputDate = output.date ? new Date(output.date) : new Date();
    
    // Mostrar la orden de servicio
    showServiceOrder('output', {
        os: output.os || 'N/A',
        quantity: output.quantity,
        engineer: output.engineer || 'N/A',
        area: output.area || 'N/A',
        movementType: output.movementType || 'output',
        itemId: output.itemId,
        itemName: item.name,
        date: outputDate.toISOString()
    });
}

// Restaurar préstamo
function restoreLoan(id) {
    if (!confirm('¿Estás seguro que deseas restaurar este préstamo al inventario?')) return;
    
    let outputIndex = outputs.findIndex(o => o.id === id);
    if (outputIndex === -1) return;
    
    let output = outputs[outputIndex];
    let itemIndex = inventory.findIndex(i => i.id === output.itemId);
    
    if (itemIndex !== -1) {
        let newStock = inventory[itemIndex].stock + output.quantity;
        
        // Actualizar stock en Firebase
        inventoryRef.child(output.itemId).update({ stock: newStock })
            .then(() => {
                // Eliminar la salida de Firebase
                outputsRef.child(id).remove()
                    .then(() => {
                        // Actualizar la interfaz se hará automáticamente por los listeners
                    })
                    .catch(error => {
                        alert('Error al eliminar el préstamo: ' + error.message);
                    });
            })
            .catch(error => {
                alert('Error al actualizar el stock: ' + error.message);
            });
    }
}

// Cargar salidas en la tabla
function loadOutputs() {
    let tableBody = document.getElementById('outputsTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    outputs.forEach(output => {
        let item = inventory.find(i => i.id === output.itemId) || { name: "Insumo no encontrado" };

        // Formatear fecha correctamente (dd/mm/aaaa)
        let outputDate = 'N/A';
        if (output.date) {
            const dateObj = new Date(output.date);
            if (!isNaN(dateObj.getTime())) {
                outputDate = dateObj.toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                });
            }
        }

        let row = document.createElement('tr');
        row.className = output.movementType === 'loan' ? 'loan-row' : '';
        row.innerHTML = `
            <td>${output.os}</td>
            <td>${item.name}</td>
            <td>${output.quantity}</td>
            <td>${output.engineer || 'N/A'}</td>
            <td>${output.area || 'N/A'}</td>
            <td>${outputDate}</td>
            <td class="action-buttons">
                <button class="btn btn-primary" onclick="viewOutputDetails('${output.id}')">
                    <i class="fas fa-eye"></i> Ver
                </button>
                <button class="btn btn-warning" onclick="editOutput('${output.id}')">
                    <i class="fas fa-edit"></i> Editar
                </button>
                ${output.movementType === 'loan' && output.status === 'pending' ? 
                 `<button class="btn btn-success" onclick="restoreLoan('${output.id}')">
                    <i class="fas fa-undo"></i> Restaurar
                 </button>` : ''}
                <button class="btn btn-danger" onclick="verifyPasswordBeforeDelete('deleteOutput', '${output.id}')">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Abrir escáner QR
function openQRScanner() {
    document.getElementById('scanQRModal').style.display = 'block';
    document.getElementById('qrScanResult').textContent = '';
}

// Iniciar escáner QR
function startQRScanner() {
    const video = document.getElementById('qrVideo');
    const resultContainer = document.getElementById('qrScanResult');
    
    if (!window.Instascan) {
        alert('Librería de escaneo QR no cargada. Asegúrate de incluir Instascan.js');
        return;
    }
    
    qrScanner = new Instascan.Scanner({ video: video });
    
    qrScanner.addListener('scan', function(content) {
        resultContainer.textContent = `Código QR detectado: ${content}`;
        
        if (content.startsWith('INSUMO:')) {
            const parts = content.split('|');
            const itemId = parts[0].replace('INSUMO:', '');
            
            const item = inventory.find(i => i.id === itemId);
            if (item) {
                stopQRScanner();
                closeModal('scanQRModal');
                
                openAddOutputModal();
                document.getElementById('outputItem').value = item.id;
                updateAvailableStock();
                
                alert(`Insumo ${item.name} seleccionado para salida`);
            } else {
                resultContainer.textContent += '\nInsumo no encontrado en el inventario';
            }
        } else {
            resultContainer.textContent += '\nEste no es un código QR válido de insumo';
        }
    });
    
    Instascan.Camera.getCameras().then(function(cameras) {
        if (cameras.length > 0) {
            qrScanner.start(cameras[0]);
        } else {
            resultContainer.textContent = 'No se encontraron cámaras disponibles';
        }
    }).catch(function(e) {
        resultContainer.textContent = 'Error al acceder a la cámara: ' + e;
    });
}

// Detener escáner QR
function stopQRScanner() {
    if (qrScanner) {
        qrScanner.stop();
        qrScanner = null;
    }
}

// Actualizar formulario de reportes según tipo seleccionado
function updateReportForm() {
    let reportType = document.getElementById('reportType').value;
    let filtersDiv = document.getElementById('reportFilters');
    
    switch(reportType) {
        case 'stock':
            filtersDiv.innerHTML = `
                <div class="form-group">
                    <label for="stockFilter">Filtrar por:</label>
                    <select id="stockFilter">
                        <option value="all">Todos los insumos</option>
                        <option value="low">Stock bajo</option>
                        <option value="critical">Stock crítico</option>
                        <option value="normal">Stock normal</option>
                    </select>
                </div>
            `;
            break;
            
        case 'movements':
            filtersDiv.innerHTML = `
                <div class="form-group">
                    <label for="movementType">Tipo de movimiento:</label>
                    <select id="movementType">
                        <option value="all">Todos</option>
                        <option value="entry">Entradas</option>
                        <option value="output">Salidas</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="movementItem">Insumo:</label>
                    <select id="movementItem">
                        <option value="all">Todos</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="movementDateFrom">Desde:</label>
                    <input type="date" id="movementDateFrom">
                </div>
                <div class="form-group">
                    <label for="movementDateTo">Hasta:</label>
                    <input type="date" id="movementDateTo">
                </div>
            `;
            
            let movementItemSelect = document.getElementById('movementItem');
            inventory.forEach(item => {
                let option = document.createElement('option');
                option.value = item.id;
                option.textContent = `${item.id} - ${item.name}`;
                movementItemSelect.appendChild(option);
            });
            break;
            
        case 'expiring':
            filtersDiv.innerHTML = `
                <div class="form-group">
                    <label for="expiringDays">Días hasta caducidad:</label>
                    <input type="number" id="expiringDays' min="1" value="30">
                </div>
            `;
            break;
    }
}

// Generar reporte
function generateReport() {
    let reportType = document.getElementById('reportType').value;
    let resultsDiv = document.getElementById('reportResults');
    resultsDiv.innerHTML = '';
    
    switch(reportType) {
        case 'stock':
            generateStockReport();
            break;
            
        case 'movements':
            generateMovementsReport();
            break;
            
        case 'expiring':
            generateExpiringReport();
            break;
    }
}

// Generar reporte de stock
function generateStockReport() {
    let filter = document.getElementById('stockFilter').value;
    let resultsDiv = document.getElementById('reportResults');
    
    let filteredItems = inventory;
    
    if (filter === 'low') {
        filteredItems = inventory.filter(item => item.stock > 0 && item.stock <= item.minStock);
    } else if (filter === 'critical') {
        filteredItems = inventory.filter(item => item.stock === 0);
    } else if (filter === 'normal') {
        filteredItems = inventory.filter(item => item.stock > item.minStock);
    }
    
    if (filteredItems.length === 0) {
        resultsDiv.innerHTML = '<p>No hay insumos que coincidan con el filtro seleccionado.</p>';
        return;
    }
    
    let html = `
        <h3>Reporte de Niveles de Stock</h3>
        <p>Filtro aplicado: ${getFilterDescription(filter)}</p>
        <table class="report-table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>Tipo</th>
                    <th>Existencias</th>
                    <th>Stock Mínimo</th>
                    <th>Estado</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    filteredItems.forEach(item => {
        let status = '';
        if (item.stock === 0) {
            status = 'Crítico (Agotado)';
        } else if (item.stock <= item.minStock) {
            status = 'Bajo';
        } else {
            status = 'Normal';
        }
        
        html += `
            <tr>
                <td>${item.id}</td>
                <td>${item.name}</td>
                <td>${item.type}</td>
                <td>${item.stock}</td>
                <td>${item.minStock}</td>
                <td>${status}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
        <button class="btn btn-primary" onclick="printReport()">Imprimir Reporte</button>
    `;
    
    resultsDiv.innerHTML = html;
}

// Generar reporte de movimientos
function generateMovementsReport() {
    let movementType = document.getElementById('movementType').value;
    let itemId = document.getElementById('movementItem').value;
    let dateFrom = document.getElementById('movementDateFrom').value;
    let dateTo = document.getElementById('movementDateTo').value;
    let resultsDiv = document.getElementById('reportResults');
    
    let filteredEntries = [];
    let filteredOutputs = [];
    
    if (movementType === 'all' || movementType === 'entry') {
        filteredEntries = entries.filter(entry => {
            let match = true;
            
            if (itemId !== 'all') {
                match = match && entry.itemId === itemId;
            }
            
            if (dateFrom) {
                match = match && new Date(entry.date) >= new Date(dateFrom);
            }
            
            if (dateTo) {
                match = match && new Date(entry.date) <= new Date(dateTo);
            }
            
            return match;
        });
    }
    
    if (movementType === 'all' || movementType === 'output') {
        filteredOutputs = outputs.filter(output => {
            let match = true;
            
            if (itemId !== 'all') {
                match = match && output.itemId === itemId;
            }
            
            if (dateFrom) {
                match = match && new Date(output.date) >= new Date(dateFrom);
            }
            
            if (dateTo) {
                match = match && new Date(output.date) <= new Date(dateTo);
            }
            
            return match;
        });
    }
    
    if (filteredEntries.length === 0 && filteredOutputs.length === 0) {
        resultsDiv.innerHTML = '<p>No hay movimientos que coincidan con los filtros seleccionados.</p>';
        return;
    }
    
    let html = `
        <h3>Reporte de Movimientos</h3>
        <table class="report-table">
            <thead>
                <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Insumo</th>
                    <th>Cantidad</th>
                    <th>Documento</th>
                    <th>Responsable</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    filteredEntries.forEach(entry => {
        let item = inventory.find(i => i.id === entry.itemId) || { name: 'Desconocido' };
        
        html += `
            <tr>
                <td>${new Date(entry.date).toLocaleDateString()}</td>
                <td>Entrada</td>
                <td>${item.name}</td>
                <td>+${entry.quantity}</td>
                <td>Vale: ${entry.voucher}</td>
                <td>N/A</td>
            </tr>
        `;
    });
    
    filteredOutputs.forEach(output => {
        let item = inventory.find(i => i.id === output.itemId) || { name: 'Desconocido' };
        
        html += `
            <tr>
                <td>${new Date(output.date).toLocaleDateString()}</td>
                <td>${output.movementType === 'loan' ? 'Préstamo' : 'Salida'}</td>
                <td>${item.name}</td>
                <td>-${output.quantity}</td>
                <td>OS: ${output.os}</td>
                <td>${output.engineer}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
        <button class="btn btn-primary" onclick="printReport()">Imprimir Reporte</button>
    `;
    
    resultsDiv.innerHTML = html;
}

// Generar reporte de caducidades
function generateExpiringReport() {
    let days = parseInt(document.getElementById('expiringDays').value) || 30;
    let resultsDiv = document.getElementById('reportResults');
    
    let today = new Date();
    let limitDate = new Date();
    limitDate.setDate(today.getDate() + days);
    
    let expiringItems = inventory.filter(item => {
        if (!item.expiration) return false;
        return new Date(item.expiration) <= limitDate && new Date(item.expiration) >= today;
    });
    
    if (expiringItems.length === 0) {
        resultsDiv.innerHTML = `<p>No hay insumos que caduquen en los próximos ${days} días.</p>`;
        return;
    }
    
    let html = `
        <h3>Reporte de Caducidades Próximas</h3>
        <p>Insumos que caducan en los próximos ${days} días (hasta ${limitDate.toLocaleDateString()})</p>
        <table class="report-table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>Tipo</th>
                    <th>Existencias</th>
                    <th>Fecha de Caducidad</th>
                    <th>Días Restantes</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    expiringItems.forEach(item => {
        let daysRemaining = Math.ceil((new Date(item.expiration) - today) / (1000 * 60 * 60 * 24));
        
        html += `
            <tr>
                <td>${item.id}</td>
                <td>${item.name}</td>
                <td>${item.type}</td>
                <td>${item.stock}</td>
                <td>${new Date(item.expiration).toLocaleDateString()}</td>
                <td>${daysRemaining}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody
        </table>
        <button class="btn btn-primary" onclick="printReport()">Imprimir Reporte</button>
    `;
    
    resultsDiv.innerHTML = html;
}

// Obtener descripción del filtro de stock
function getFilterDescription(filter) {
    switch(filter) {
        case 'all': return 'Todos los insumos';
        case 'low': return 'Stock bajo (existencias ≤ stock mínimo)';
        case 'critical': return 'Stock crítico (existencias = 0)';
        case 'normal': return 'Stock normal (existencias > stock mínimo)';
        default: return '';
    }
}

// ===== FUNCIÓN MEJORADA PARA IMPRIMIR REPORTES =====
function printReport() {
    const cleanHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Reporte del Sistema</title>
            <meta charset="UTF-8">
            <style>
                @page { 
                    margin: 0 !important; 
                    padding: 0 !important; 
                }
                body { 
                    margin: 0 !important; 
                    padding: 5mm !important; 
                    font-family: Arial, sans-serif;
                }
                * { 
                    color: black !important; 
                    background: transparent !important; 
                }
                table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    font-size: 10pt; 
                }
                th, td { 
                    padding: 3px; 
                    border: 1px solid black; 
                }
                .report-table {
                    page-break-inside: avoid;
                }
            </style>
        </head>
        <body onload="window.print(); setTimeout(function() { window.close(); }, 100);">
            ${document.getElementById('reportResults').innerHTML}
        </body>
        </html>
    `;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(cleanHtml);
    printWindow.document.close();
}

// Cerrar modal
function closeModal(modalId) {
    if (modalId === 'scanQRModal') {
        stopQRScanner();
    }
    
    // Si se cierra el modal de entrada/salida, limpiar las listas
    if (modalId === 'entryModal') {
        restoreEntryFormFields();
        selectedEntryItems = [];
        updateEntryItemsDisplay();
    }
    
    if (modalId === 'outputModal') {
        selectedOutputItems = [];
        updateOutputItemsDisplay();
        editingOutputId = null;
    }
    
    document.getElementById(modalId).style.display = 'none';
}

// Establecer fechas por defecto en los filtros
function setDefaultDates() {
    let today = new Date();
    let firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // Verifica si los elementos existen antes de intentar establecer valores
    const dateFromInput = document.getElementById('movementDateFrom');
    const dateToInput = document.getElementById('movementDateTo');
    
    if (dateFromInput && dateToInput) {
        dateFromInput.value = firstDayOfMonth.toISOString().split('T')[0];
        dateToInput.value = today.toISOString().split('T')[0];
    } else {
        console.log("Los elementos de fecha no están disponibles en el DOM");
    }
}

// ===== FUNCIONES PARA MÚLTIPLES MARCAS ===== //

// Función para agregar una marca a la lista de seleccionadas
function addBrand() {
    const brandSelector = document.getElementById('brandSelector');
    const selectedBrand = brandSelector.value;
    
    if (!selectedBrand) return;
    
    const selectedBrandsContainer = document.getElementById('selectedBrandsContainer');
    const brandName = brandSelector.options[brandSelector.selectedIndex].text;
    
    // Verificar si la marca ya fue agregada
    if (document.getElementById(`brand-${selectedBrand}`)) {
        alert('Esta marca ya ha sido agregada');
        brandSelector.value = '';
        return;
    }
    
    // Crear elemento para mostrar la marca seleccionada
    const brandChip = document.createElement('div');
    brandChip.id = `brand-${selectedBrand}`;
    brandChip.style.display = 'flex';
    brandChip.style.alignItems = 'center';
    brandChip.style.gap = '0.5rem';
    brandChip.style.padding = '0.5rem 1rem';
    brandChip.style.backgroundColor = '#e5e7eb';
    brandChip.style.borderRadius = 'var(--border-radius-sm)';
    brandChip.style.marginBottom = '0.5rem';
    
    brandChip.innerHTML = `
        <span>${brandName}</span>
        <button type="button" onclick="removeBrand('${selectedBrand}')" 
                style="background: none; border: none; cursor: pointer; color: #ef4444;">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    selectedBrandsContainer.appendChild(brandChip);
    
    // Actualizar el campo oculto con las marcas seleccionadas
    updateSelectedBrandsField();
    
    // Reiniciar el selector
    brandSelector.value = '';
}

// Función para eliminar una marca de la lista de seleccionadas
function removeBrand(brandId) {
    const brandChip = document.getElementById(`brand-${brandId}`);
    if (brandChip) {
        brandChip.remove();
        updateSelectedBrandsField();
    }
}

// Función para actualizar el campo oculto con las marcas seleccionadas
function updateSelectedBrandsField() {
    const selectedBrandsContainer = document.getElementById('selectedBrandsContainer');
    const brandChips = selectedBrandsContainer.querySelectorAll('div[id^="brand-"]');
    const selectedBrands = [];
    
    brandChips.forEach(chip => {
        const brandId = chip.id.replace('brand-', '');
        selectedBrands.push(brandId);
    });
    
    document.getElementById('itemBrands').value = selectedBrands.join(',');
}

// Función para cargar marcas en el selector
function loadBrandSelectorOptions() {
    const brandSelector = document.getElementById('brandSelector');
    if (!brandSelector) return;
    
    const currentValue = brandSelector.value;
    
    // Limpiar manteniendo la primera opción
    while (brandSelector.options.length > 1) {
        brandSelector.remove(1);
    }
    
    // Eliminar duplicados usando Set
    const uniqueBrands = [...new Set(itemBrands.map(b => b.name))];
    
    // Ordenar alfabéticamente
    uniqueBrands.sort((a, b) => a.localeCompare(b));
    
    // Agregar opciones de marcas
    uniqueBrands.forEach(brand => {
        const option = document.createElement('option');
        option.value = brand;
        option.textContent = brand;
        brandSelector.add(option);
    });
    
    // Restaurar valor seleccionado si existe
    if (currentValue && [...brandSelector.options].some(o => o.value === currentValue)) {
        brandSelector.value = currentValue;
    }
}

// Función para cargar marcas seleccionadas al editar un insumo
function loadSelectedBrands(brandsString) {
    const selectedBrandsContainer = document.getElementById('selectedBrandsContainer');
    if (!selectedBrandsContainer) return;
    
    selectedBrandsContainer.innerHTML = '';
    
    if (!brandsString) return;
    
    const brandIds = brandsString.split(',');
    
    brandIds.forEach(brandId => {
        if (!brandId) return;
        
        const brand = itemBrands.find(b => b.name === brandId);
        if (brand) {
            const brandChip = document.createElement('div');
            brandChip.id = `brand-${brand.name}`;
            brandChip.style.display = 'flex';
            brandChip.style.alignItems = 'center';
            brandChip.style.gap = '0.5rem';
            brandChip.style.padding = '0.5rem 1rem';
            brandChip.style.backgroundColor = '#e5e7eb';
            brandChip.style.borderRadius = 'var(--border-radius-sm)';
            brandChip.style.marginBottom = '0.5rem';
            
            brandChip.innerHTML = `
                <span>${brand.name}</span>
                <button type="button" onclick="removeBrand('${brand.name}')" 
                        style="background: none; border: none; cursor: pointer; color: #ef4444;">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            selectedBrandsContainer.appendChild(brandChip);
        }
    });
    
    updateSelectedBrandsField();
}

// ===== FUNCIONES PARA MÚLTIPLES INSUMOS EN ENTRADAS =====

function addEntryItem() {
    const itemSelect = document.getElementById('entryItem');
    const itemId = itemSelect.value;
    
    if (!itemId) {
        alert('Seleccione un insumo');
        return;
    }
    
    const existingItem = selectedEntryItems.find(item => item.id === itemId);
    if (existingItem) {
        alert('Este insumo ya ha sido agregado');
        return;
    }
    
    const item = inventory.find(i => i.id === itemId);
    if (!item) {
        alert('Insumo no encontrado');
        return;
    }
    
    selectedEntryItems.push({
        id: itemId,
        name: item.name,
        quantity: 1,
        stock: item.stock,
        availableStock: item.stock
    });
    
    updateEntryItemsDisplay();
    itemSelect.value = '';
    
    // Mostrar la sección de insumos seleccionados
    document.getElementById('entryItemsContainer').style.display = 'block';
    document.getElementById('entryTotalQuantity').style.display = 'block';
}

function removeEntryItem(itemId) {
    selectedEntryItems = selectedEntryItems.filter(item => item.id !== itemId);
    updateEntryItemsDisplay();
}

function updateEntryItemQuantity(itemId, quantity) {
    if (quantity < 1) return;
    
    const item = selectedEntryItems.find(i => i.id === itemId);
    if (item) {
        item.quantity = quantity;
        updateEntryItemsDisplay();
    }
}

function updateEntryItemsDisplay() {
    const container = document.getElementById('entryItemsContainer');
    const totalDiv = document.getElementById('entryTotalQuantity');
    const totalSpan = document.getElementById('totalEntryItems');
    
    if (selectedEntryItems.length === 0) {
        container.style.display = 'none';
        totalDiv.style.display = 'none';
        
        // Mostrar campo de cantidad individual si no hay insumos
        document.getElementById('entryQuantity').style.display = 'block';
        document.getElementById('entryQuantity').parentElement.style.display = 'block';
        return;
    }
    
    container.style.display = 'block';
    totalDiv.style.display = 'block';
    
    let html = '';
    let totalItems = 0;
    
    selectedEntryItems.forEach(item => {
        totalItems += item.quantity;
        
        html += `
            <div class="selected-item" id="entry-item-${item.id}">
                <div class="item-info">
                    <div class="item-name">${item.name} (${item.id})</div>
                    <div class="item-details">
                        <span>Existencias actuales: ${item.stock}</span>
                    </div>
                </div>
                <div class="item-actions">
                    <div class="quantity-control">
                        <button type="button" onclick="updateEntryItemQuantity('${item.id}', ${item.quantity - 1})" ${item.quantity <= 1 ? 'disabled' : ''}>
                            <i class="fas fa-minus"></i>
                        </button>
                        <input type="number" value="${item.quantity}" min="1" 
                               onchange="updateEntryItemQuantity('${item.id}', this.value)">
                        <button type="button" onclick="updateEntryItemQuantity('${item.id}', ${item.quantity + 1})">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                    <button class="btn btn-danger" onclick="removeEntryItem('${item.id}')" style="padding: 0.5rem; width: auto;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    totalSpan.textContent = totalItems;
    
    // OCULTAR el campo de cantidad individual cuando hay insumos seleccionados
    document.getElementById('entryQuantity').style.display = 'none';
    document.getElementById('entryQuantity').parentElement.style.display = 'none';
}

// ===== FUNCIONES PARA MÚLTIPLES INSUMOS EN SALIDAS =====

function addOutputItem() {
    const itemSelect = document.getElementById('outputItem');
    const itemId = itemSelect.value;
    
    if (!itemId) {
        alert('Seleccione un insumo');
        return;
    }
    
    const existingItem = selectedOutputItems.find(item => item.id === itemId);
    if (existingItem) {
        alert('Este insumo ya ha sido agregado');
        return;
    }
    
    const item = inventory.find(i => i.id === itemId);
    if (!item) {
        alert('Insumo no encontrado');
        return;
    }
    
    // Verificar stock disponible
    if (item.stock <= 0) {
        alert('Stock insuficiente para este insumo');
        return;
    }
    
    selectedOutputItems.push({
        id: itemId,
        name: item.name,
        quantity: 1,
        stock: item.stock,
        maxQuantity: item.stock
    });
    
    updateOutputItemsDisplay();
    itemSelect.value = '';
    updateAvailableStock();
}

function removeOutputItem(itemId) {
    selectedOutputItems = selectedOutputItems.filter(item => item.id !== itemId);
    updateOutputItemsDisplay();
    updateAvailableStock();
}

function updateOutputItemQuantity(itemId, quantity) {
    const item = selectedOutputItems.find(i => i.id === itemId);
    if (item) {
        quantity = Math.max(1, Math.min(quantity, item.maxQuantity));
        item.quantity = quantity;
        updateOutputItemsDisplay();
    }
}

function updateOutputItemsDisplay() {
function updateOutputItemsDisplay() {
    const container = document.getElementById('outputItemsContainer');
    const totalDiv = document.getElementById('outputTotalQuantity');
    const totalSpan = document.getElementById('totalOutputItems');
    
    if (selectedOutputItems.length === 0) {
        container.style.display = 'none';
        totalDiv.style.display = 'none';
        
        // Mostrar campo de cantidad individual si no hay insumos
        document.getElementById('outputQuantity').style.display = 'block';
        document.getElementById('outputQuantity').parentElement.style.display = 'block';
        return;
    }
    
    container.style.display = 'block';
    totalDiv.style.display = 'block';
    
    let html = '';
    let totalItems = 0;
    
    selectedOutputItems.forEach(item => {
        totalItems += item.quantity;
        
        html += `
            <div class="selected-item" id="output-item-${item.id}">
                <div class="item-info">
                    <div class="item-name">${item.name} (${item.id})</div>
                    <div class="item-details">
                        <span>Disponible: ${item.stock}</span>
                    </div>
                </div>
                <div class="item-actions">
                    <div class="quantity-control">
                        <button type="button" onclick="updateOutputItemQuantity('${item.id}', ${item.quantity - 1})" ${item.quantity <= 1 ? 'disabled' : ''}>
                            <i class="fas fa-minus"></i>
                        </button>
                        <input type="number" value="${item.quantity}" min="1" max="${item.maxQuantity}"
                               onchange="updateOutputItemQuantity('${item.id}', this.value)">
                        <button type="button" onclick="updateOutputItemQuantity('${item.id}', ${item.quantity + 1})" ${item.quantity >= item.maxQuantity ? 'disabled' : ''}>
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                    <button class="btn btn-danger" onclick="removeOutputItem('${item.id}')" style="padding: 0.5rem; width: auto;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    totalSpan.textContent = totalItems;
    
    // OCULTAR el campo de cantidad individual cuando hay insumos seleccionados
    document.getElementById('outputQuantity').style.display = 'none';
    document.getElementById('outputQuantity').parentElement.style.display = 'none';
}

// ===== FUNCIÓN PARA HACER EL FOLIO DE SALIDAS EDITABLE =====

function makeOutputOSEditable() {
    const osInput = document.getElementById('outputOS');
    const isReadOnly = osInput.hasAttribute('readonly');
    
    if (isReadOnly) {
        osInput.removeAttribute('readonly');
        osInput.style.backgroundColor = '#ffffe0';
        osInput.style.borderColor = '#f59e0b';
        showToast('🔓 Folio editable. Puede ingresar un número personalizado.');
    } else {
        osInput.setAttribute('readonly', 'true');
        osInput.style.backgroundColor = '';
        osInput.style.borderColor = '';
        showToast('🔒 Folio en modo automático');
    }
}

// ===== FUNCIÓN PARA EDITAR SALIDAS COMPLETAS =====

function editOutput(id) {
    const output = outputs.find(o => o.id === id);
    if (!output) return;
    
    // Solicitar contraseña
    const password = prompt("🔒 Ingrese la contraseña para editar esta salida:");
    
    if (password !== DELETE_PASSWORD) {
        if (password !== null) {
            alert("❌ Contraseña incorrecta. No se puede editar.");
        }
        return;
    }
    
    editingOutputId = id;
    
    // Obtener el item original
    const item = inventory.find(i => i.id === output.itemId);
    
    document.getElementById('outputModalTitle').textContent = 'Editar Salida';
    document.getElementById('outputForm').reset();
    
    // Cargar datos existentes
    document.getElementById('outputOS').value = output.os;
    document.getElementById('outputOS').removeAttribute('readonly');
    document.getElementById('outputDate').value = output.date.split('T')[0];
    document.getElementById('movementType').value = output.movementType;
    
    // Cargar ingeniero
    if (output.isCustomEngineer) {
        document.getElementById('outputEngineer').value = 'OTRO';
        document.getElementById('customEngineer').value = output.engineer;
        document.getElementById('customEngineer').style.display = 'block';
    } else {
        document.getElementById('outputEngineer').value = output.engineer;
        document.getElementById('customEngineer').style.display = 'none';
    }
    
    // Cargar área
    if (output.isCustomArea) {
        document.getElementById('outputArea').value = 'OTRO';
        document.getElementById('customArea').value = output.area;
        document.getElementById('customArea').style.display = 'block';
    } else {
        document.getElementById('outputArea').value = output.area;
        document.getElementById('customArea').style.display = 'none';
    }
    
    document.getElementById('outputComments').value = output.comments || '';
    
    // Cargar insumo(s) - convertir el insumo único a múltiples
    selectedOutputItems = [{
        id: output.itemId,
        name: item ? item.name : 'Desconocido',
        quantity: output.quantity,
        stock: item ? item.stock + output.quantity : 0, // Sumar la cantidad devuelta
        maxQuantity: item ? item.stock + output.quantity : 0
    }];
    
    updateOutputItemsDisplay();
    updateAvailableStock();
    
    // Mostrar el modal
    document.getElementById('outputModal').style.display = 'block';
}

// Función para resetear el formulario de insumos
function resetItemForm() {
    document.getElementById('itemForm').reset();
    document.getElementById('selectedBrandsContainer').innerHTML = '';
    document.getElementById('itemBrands').value = '';
    document.getElementById('customType').style.display = 'none';
    document.getElementById('customType').required = false;
}

// ===== FUNCIONES DE ORDENAMIENTO ===== //
// Función para ordenamiento numérico inteligente de IDs
function smartIdSort(a, b) {
    // Función para dividir el ID en partes numéricas y de texto
    const parseIdParts = (id) => {
        return id.split(/(\d+)/).filter(part => part !== '');
    };

    const partsA = parseIdParts(a);
    const partsB = parseIdParts(b);

    // Comparar parte por parte
    const maxLength = Math.max(partsA.length, partsB.length);
    
    for (let i = 0; i < maxLength; i++) {
        const partA = partsA[i] || '';
        const partB = partsB[i] || '';

        // Convertir a números si ambos son numéricos
        const numA = parseInt(partA);
        const numB = parseInt(partB);
        
        // Si ambas partes son números puros, comparar numéricamente
        if (!isNaN(numA) && !isNaN(numB) && partA === numA.toString() && partB === numB.toString()) {
            if (numA < numB) return -1;
            if (numA > numB) return 1;
        } else {
            // Comparar como strings (para partes con texto o mixed)
            if (partA < partB) return -1;
            if (partA > partB) return 1;
        }
    }

    return 0; // Son iguales
}

// Función específica para IDs con guiones bajos (8_3, 9_16_2, etc.)
function customIdSort(a, b) {
    // Si ambos IDs contienen guiones bajos, usar comparación especial
    if (a.includes('_') && b.includes('_')) {
        const partsA = a.split('_').map(part => {
            const num = parseInt(part);
            return isNaN(num) ? part : num;
        });
        
        const partsB = b.split('_').map(part => {
            const num = parseInt(part);
            return isNaN(num) ? part : num;
        });

        // Comparar parte por parte
        for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
            const partA = partsA[i] || 0;
            const partB = partsB[i] || 0;

            if (partA < partB) return -1;
            if (partA > partB) return 1;
        }
        return 0;
    }
    
    // Para otros casos, usar el ordenamiento inteligente general
    return smartIdSort(a, b);
}

// Configurar listeners para cambios en tiempo real - VERSIÓN CORREGIDA
function setupRealTimeListeners() {
    // Listener para inventario - CON ORDENAMIENTO
    inventoryRef.on('value', (snapshot) => {
        const data = snapshot.val();
        // Convertir objeto a array manteniendo el ID
        inventory = data ? Object.keys(data).map(key => ({
            id: key,
            ...data[key]
        })) : [];
        
        // ORDENAR MANUALMENTE - LÍNEA NUEVA
        inventory.sort((a, b) => customIdSort(a.id, b.id));
        
        console.log('Inventario cargado y ordenado:', inventory.length, 'items');
        loadInventory();
        checkStockAlerts();
        loadItemOptions();
        loadItemTypeOptions();
        loadTypeFilterOptions();
    });
    
    // Listener para entradas - CORREGIDO
    entriesRef.on('value', (snapshot) => {
        const data = snapshot.val();
        entries = data ? Object.keys(data).map(key => ({
            id: key,
            ...data[key]
        })) : [];
        console.log('Entradas cargadas:', entries.length, 'registros');
        loadEntries();
    });
    
    // Listener para salidas - CORREGIDO
    outputsRef.on('value', (snapshot) => {
        const data = snapshot.val();
        outputs = data ? Object.keys(data).map(key => ({
            id: key,
            ...data[key]
        })) : [];
        console.log('Salidas cargadas:', outputs.length, 'registros');
        loadOutputs();
    });

    // Listener para tipos
    typesRef.on('value', (snapshot) => {
        const data = snapshot.val();
        itemTypes = data ? Object.keys(data).map(key => ({
            id: key,
            ...data[key]
        })) : [];
        loadItemTypeOptions();
    });

    // Listener para marcas
    brandsRef.on('value', (snapshot) => {
        const data = snapshot.val();
        itemBrands = data ? Object.keys(data).map(key => ({
            id: key,
            ...data[key]
        })) : [];
        
        loadItemBrandOptions();
        loadBrandSelectorOptions();
        console.log('Marcas cargadas:', itemBrands.length);
    });

    // Listener para áreas
    areasRef.on('value', (snapshot) => {
        const data = snapshot.val();
        areas = data ? Object.keys(data).map(key => ({
            id: key,
            ...data[key]
        })) : [];
        loadAreaOptions();
        console.log('Áreas cargadas:', areas.length);
    });
}

// Función para inicializar la aplicación
function initializeApp() {
    console.log('Inicializando aplicación...');
    
    // Configurar fechas por defecto
    setDefaultDates();
    
    // Iniciar listeners de Firebase
    setupRealTimeListeners();
    
    // Cargar datos de folios
    loadFolioData();
    
    console.log('Aplicación inicializada correctamente');
}

// Cargar datos iniciales al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    // Añade un elemento para mostrar el estado de la conexión
    const statusDiv = document.createElement('div');
    statusDiv.id = 'connection-status';
    statusDiv.style.position = 'fixed';
    statusDiv.style.bottom = '10px';
    statusDiv.style.right = '10px';
    statusDiv.style.padding = '5px 10px';
    statusDiv.style.backgroundColor = '#f8f8f8';
    statusDiv.style.borderRadius = '5px';
    statusDiv.style.zIndex = '10000';
    statusDiv.style.fontSize = '12px';
    document.body.appendChild(statusDiv);

  // Event listener para cambios en la cantidad
document.addEventListener('DOMContentLoaded', function() {
    // Agregar evento para cambios en la cantidad
    document.addEventListener('input', function(e) {
        if (e.target.id === 'entryQuantity') {
            updateExpirationQuantities();
            
            // Mostrar/ocultar sección de caducidad basado en si el item tiene fecha de caducidad
            const itemId = document.getElementById('entryItem').value;
            if (itemId) {
                const item = inventory.find(i => i.id === itemId);
                if (item && item.expiration) {
                    document.getElementById('expirationSection').style.display = 'block';
                }
            }
        }
    });
    
    // Evento para cambios en la selección de item
    document.addEventListener('change', function(e) {
        if (e.target.id === 'entryItem') {
            const itemId = e.target.value;
            if (itemId) {
                const item = inventory.find(i => i.id === itemId);
                if (item && item.expiration) {
                    document.getElementById('expirationSection').style.display = 'block';
                } else {
                    document.getElementById('expirationSection').style.display = 'none';
                    document.getElementById('expirationDatesContainer').innerHTML = '';
                    const remainingQuantity = document.getElementById('remainingQuantity');
                    if (remainingQuantity) remainingQuantity.remove();
                }
            }
        }
    });

    // Event listener para cambios en la selección de item
    document.addEventListener('change', function(e) {
        if (e.target.id === 'entryItem') {
            checkItemExpiration();
        }
        
        if (e.target.id === 'entryQuantity') {
            updateExpirationQuantities();
        }
    });
  
});
    
    // Inicializar la aplicación
    initializeApp();
});
