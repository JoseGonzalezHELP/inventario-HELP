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

// Datos en memoria
let inventory = [];
let entries = [];
let outputs = [];
let qrScanner = null;
let itemTypes = [];
let itemBrands = [];  
let areas = [];

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

// Función para generar la orden de servicio (VERSIÓN COMPLETA CORREGIDA)
function generateServiceOrder(type, data) {
    // Usar la fecha del registro si está disponible, de lo contrario usar la fecha actual
    const recordDate = data.date ? new Date(data.date) : new Date();
    const formattedDate = recordDate.toLocaleDateString('es-ES', {
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
    
    if (type === 'output') {
        description = `Solicitud de ${data.movementType === 'loan' ? 'préstamo' : 'salida'} de insumo biomédico`;
        report = `Entrega de ${data.quantity} unidad(es) de insumo biomédico ${data.itemName}`;
        workers = data.engineer || 'Personal de biomédica';
        areaText = `Departamento o área: ${data.area || 'Área solicitante'}`;
    } else if (type === 'entry') {
        description = `Recepción de insumos biomédicos en el almacén`;
        report = `Recepción de ${data.quantity} unidad(es) de insumo biomédico ${data.itemName}`;
        workers = data.responsible || 'Personal de almacén';
        areaText = 'Departamento o área: Almacén Biomédico';
    }
    
    const serviceOrderHTML = `
        <div class="service-order-container">
            <div class="images-container">
                <div class="logo">
                    <img src="https://raw.githubusercontent.com/JoseGonzalezHELP/inventario-HELP/main/SecretariaDeSalud.png" alt="Secretaría de Salud" height="110" onerror="this.style.display='none'; this.parentNode.innerHTML='[Imagen 1 - Secretaría de Salud]'">
                </div>
                <div class="logo">
                    <img src="./PEDIATRICO.jpeg" alt="Hospital Pediátrico" height="80" onerror="this.style.display='none'; this.parentNode.innerHTML='[Imagen 2 - Hospital]'">
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
            
            <div class="expedition-container">
                <div></div>
                <div class="expedition-date">
                    <span>Fecha de Expediente</span>
                    <div class="date-field">${formattedDate}</div>
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
                        <div class="underline">Fecha de terminación:</div>
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
                        <div class="signature-name">El trabajador</div>
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

// Función para imprimir la orden de servicio (MEJORADA)
function printServiceOrder() {
    const printContent = document.getElementById('serviceOrderContent').innerHTML;
    const originalContent = document.body.innerHTML;
    
    // Crear un documento limpio para imprimir
    const printDocument = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Orden de Servicio</title>
            <style>
                @page { margin: 0; size: auto; }
                body { margin: 0; padding: 10px; }
                .no-print, .btn, .close, .modal-actions { display: none !important; }
                * { color: black !important; background: white !important; }
                .service-order-container { box-shadow: none !important; border: none !important; }
                .text-area[contenteditable="true"] { border: 1px solid #ccc !important; background: white !important; }
            </style>
        </head>
        <body onload="window.print(); window.close();">
            ${printContent}
        </body>
        </html>
    `;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printDocument);
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

// Guardar insumo (nuevo o editado)
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

// Abrir modal para registrar entrada
function openAddEntryModal() {
    document.getElementById('entryModalTitle').textContent = 'Registrar Entrada';
    document.getElementById('entryForm').reset();
    document.getElementById('entryDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('customResponsible').style.display = 'none';
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

// Guardar entrada
function saveEntry() {
    // Obtener valores del formulario
    const itemId = document.getElementById('entryItem').value;
    const voucher = document.getElementById('entryVoucher').value;
    const invoice = document.getElementById('entryInvoice').value;
    const quantity = parseInt(document.getElementById('entryQuantity').value);
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
    
    // Validaciones
    if (!itemId || !voucher || isNaN(quantity) || quantity <= 0 || !date || !responsible) {
        alert('Complete los campos requeridos (*)');
        return;
    }
    
    // VERIFICAR FOLIO DUPLICADO
    const folioExists = entries.some(entry => entry.voucher === voucher) || 
                       outputs.some(output => output.os === voucher);
    
    if (folioExists) {
        alert('❌ Error: Este número de folio ya existe en el sistema. No se puede registrar duplicados.');
        return;
    }
    
    // Resto del código existente...
    // Buscar el insumo en el inventario
    const itemIndex = inventory.findIndex(i => i.id === itemId);
    if (itemIndex === -1) {
        alert('Insumo no encontrado');
        return;
    }
    
    // Crear objeto de entrada
    const entryId = Date.now().toString();
    const entry = {
        id: entryId,
        itemId: itemId,
        voucher: voucher,
        invoice: invoice || null,
        quantity: quantity,
        responsible: responsible,
        comments: comments || null,
        date: document.getElementById('entryDate').value + 'T00:00:00',
        isCustomResponsible: document.getElementById('entryResponsible').value === 'OTRO'
    };
    
    // Guardar en Firebase
    entriesRef.child(entryId).set(entry)
        .then(() => {
            // Actualizar stock
            const newStock = inventory[itemIndex].stock + quantity;
            inventoryRef.child(itemId).update({ stock: newStock })
                .then(() => {
                    // Mostrar orden de servicio
                    showServiceOrder('entry', {
                        voucher: voucher,
                        quantity: quantity,
                        responsible: responsible,
                        itemId: itemId,
                        itemName: inventory[itemIndex].name
                    });
                    
                    closeModal('entryModal');
                    showToast('✅ Entrada registrada correctamente');
                })
                .catch(error => alert('Error al actualizar stock: ' + error));
        })
        .catch(error => alert('Error al guardar entrada: ' + error));
}

// Ver detalles de entrada - CORREGIDA
function viewEntryDetails(id) {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;

    const item = inventory.find(i => i.id === entry.itemId) || { name: "Desconocido" };
    
    // Mostrar la orden de servicio
    showServiceOrder('entry', {
        voucher: entry.voucher || 'N/A',
        quantity: entry.quantity,
        responsible: entry.responsible || 'N/A',
        itemId: entry.itemId,
        itemName: item.name,
        date: entry.date || new Date().toISOString()
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
            </td>
        `;
        tableBody.appendChild(row);
    });
}
// Abrir modal para registrar salida
function openAddOutputModal() {
    document.getElementById('outputModalTitle').textContent = 'Registrar Salida';
    document.getElementById('outputForm').reset();
    document.getElementById('outputDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('customEngineer').style.display = 'none';
    document.getElementById('outputModal').style.display = 'block';
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
    const itemId = document.getElementById('outputItem').value;
    const os = document.getElementById('outputOS').value;
    let engineer = document.getElementById('outputEngineer').value;
    const quantity = parseInt(document.getElementById('outputQuantity').value);
    const date = document.getElementById('outputDate').value;
    const movementType = document.getElementById('movementType').value;
    
    // Nuevos campos
    let area = document.getElementById('outputArea').value;
    const comments = document.getElementById('outputComments').value;

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

    if (!itemId || !os || !engineer || !area || isNaN(quantity) || quantity <= 0 || !date) {
        alert('Complete los campos requeridos');
        return;
    }

    // VERIFICAR FOLIO DUPLICADO
    const folioExists = entries.some(entry => entry.voucher === os) || 
                       outputs.some(output => output.os === os);
    
    if (folioExists) {
        alert('❌ Error: Este número de folio ya existe en el sistema. No se puede registrar duplicados.');
        return;
    }

    const item = inventory.find(i => i.id === itemId);
    if (!item) {
        alert('Insumo no encontrado');
        return;
    }

    if (item.stock < quantity) {
        alert('Stock insuficiente');
        return;
    }

    const outputId = Date.now().toString();
    const output = {
        id: outputId,
        itemId: itemId,
        os: os,
        engineer: engineer,
        quantity: quantity,
        date: document.getElementById('outputDate').value + 'T00:00:00',
        movementType: movementType,
        status: movementType === 'loan' ? 'pending' : 'completed',
        isCustomEngineer: document.getElementById('outputEngineer').value === 'OTRO',
        area: area,
        isCustomArea: document.getElementById('outputArea').value === 'OTRO',
        comments: comments || null
    };

    outputsRef.child(outputId).set(output)
        .then(() => {
            const newStock = item.stock - quantity;
            inventoryRef.child(itemId).update({ stock: newStock })
                .then(() => {
                    // Mostrar orden de servicio
                    showServiceOrder('output', {
                        os: os,
                        quantity: quantity,
                        engineer: engineer,
                        area: area,
                        movementType: movementType,
                        itemId: itemId,
                        itemName: item.name
                    });
                    
                    closeModal('outputModal');
                    showToast('✅ Salida registrada correctamente');
                });
        })
        .catch(error => alert('Error: ' + error.message));
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
                ${output.movementType === 'loan' && output.status === 'pending' ? 
                 `<button class="btn btn-success" onclick="restoreLoan('${output.id}')">
                    <i class="fas fa-undo"></i> Restaurar
                 </button>` : ''}
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

// Función para resetear el formulario de insumos
function resetItemForm() {
    document.getElementById('itemForm').reset();
    document.getElementById('selectedBrandsContainer').innerHTML = '';
    document.getElementById('itemBrands').value = '';
    document.getElementById('customType').style.display = 'none';
    document.getElementById('customType').required = false;
}

// Configurar listeners para cambios en tiempo real
function setupRealTimeListeners() {
    // Listener para inventario
    inventoryRef.on('value', (snapshot) => {
        const data = snapshot.val();
        inventory = data ? Object.values(data) : [];
        loadInventory();
        checkStockAlerts();
        loadItemOptions();
        loadItemTypeOptions();
        loadTypeFilterOptions();
    });
    
    // Listener para entradas
    entriesRef.on('value', (snapshot) => {
        const data = snapshot.val();
        entries = data ? Object.values(data) : [];
        loadEntries();
    });
    
    // Listener para salidas
    outputsRef.on('value', (snapshot) => {
        const data = snapshot.val();
        outputs = data ? Object.values(data) : [];
        loadOutputs();
    });

    // Listener para tipos
    typesRef.on('value', (snapshot) => {
        const data = snapshot.val();
        itemTypes = data ? Object.values(data) : [];
        loadItemTypeOptions();
    });

    // Listener para marcas
    brandsRef.on('value', (snapshot) => {
        const data = snapshot.val();
        itemBrands = data ? Object.values(data) : [];
        
        loadItemBrandOptions();
        loadBrandSelectorOptions();
        console.log(`Marcas predefinidas cargadas: ${itemBrands.length}`);
    });

      // Listener para áreas
    areasRef.on('value', (snapshot) => {
        const data = snapshot.val();
        areas = data ? Object.values(data) : [];
        loadAreaOptions();
    });
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
    document.body.appendChild(statusDiv);

  
    // Configurar listeners para cambios en tiempo real
    setupRealTimeListeners();
    
    // Cargar opciones de los selects solo si estamos en la pestaña correcta
    if (document.getElementById('inventoryTable')) {
        loadItemOptions();
        loadTypeFilterOptions();
    }
    
    if (document.getElementById('itemType')) {
        loadItemTypeOptions();
    }

    if (document.getElementById('itemBrand')) {
        loadItemBrandOptions();
    }
  
    // Solo establecer fechas si estamos en la pestaña de reportes
    if (document.getElementById('reportType')) {
        setDefaultDates();
    }
});
