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

// Referencias a la base de datos
const inventoryRef = database.ref('inventory');
const entriesRef = database.ref('entries');
const outputsRef = database.ref('outputs');
const typesRef = database.ref('types');

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

// Datos en memoria
let inventory = [];
let entries = [];
let outputs = [];
let qrScanner = null;
let itemTypes = [];

// Cargar datos iniciales al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    // Configurar listeners para cambios en tiempo real
    setupRealTimeListeners();
    
    // Cargar opciones de los selects
    loadItemOptions();
    loadItemTypeOptions();
    loadTypeFilterOptions();
    setDefaultDates();
});

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

    typesRef.on('value', (snapshot) => {
      const data = snapshot.val();
      itemTypes = data ? Object.values(data) : [];
      loadItemTypeOptions();
    });
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
            <td>${item.brand}</td>
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
    let typeSelect = document.getElementById('itemType');
    
    // Mantener las primeras 6 opciones (las fijas + "OTRO")
    while (typeSelect.options.length > 6) {
        typeSelect.remove(6);
    }
    
    // Agregar los tipos desde Firebase
    itemTypes.forEach(type => {
        let option = document.createElement('option');
        option.value = type.name;
        option.textContent = type.name;
        typeSelect.insertBefore(option, typeSelect.options[typeSelect.options.length - 1]);
    });
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
// Abrir modal para agregar insumo
function openAddItemModal() {
    document.getElementById('itemModalTitle').textContent = 'Agregar Nuevo Insumo';
    document.getElementById('itemForm').reset();
    document.getElementById('itemId').value = '';
    document.getElementById('customType').style.display = 'none';
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
    document.getElementById('itemBrand').value = item.brand;
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
    let itemBrand = document.getElementById('itemBrand').value;
    let itemModel = document.getElementById('itemModel').value;
    let itemSize = document.getElementById('itemSize').value;
    let itemInitialStock = parseInt(document.getElementById('itemInitialStock').value);
    let itemMinStock = parseInt(document.getElementById('itemMinStock').value);
    let itemExpiration = document.getElementById('itemExpiration').value;
    
    // Manejo de tipos personalizados
    if (itemType === 'OTRO' && customType) {
        itemType = customType.toUpperCase();
        
        // Verificar si el tipo ya existe en Firebase
        if (!itemTypes.some(t => t.name.toUpperCase() === itemType)) {
            // Crear nuevo tipo en Firebase
            const newType = {
                id: Date.now().toString(),
                name: itemType
            };
            typesRef.child(newType.id).set(newType)
                .catch(error => {
                    console.error('Error al guardar el nuevo tipo:', error);
                });
        }
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
        brand: itemBrand,
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
function printQR() {
    let printWindow = window.open('', '', 'width=600,height=600');
    printWindow.document.write('<html><head><title>Imprimir Código QR</title></head><body>');
    printWindow.document.write(document.getElementById('qrCode').innerHTML);
    printWindow.document.write(document.getElementById('qrItemInfo').innerHTML);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
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
        invoice: invoice || null, // Guarda null si no hay factura
        quantity: quantity,
        responsible: responsible,
        comments: comments || null, // Guarda null si no hay comentarios
        date: new Date(date).toISOString(),
        isCustomResponsible: document.getElementById('entryResponsible').value === 'OTRO'
    };
    
    // Guardar en Firebase
    entriesRef.child(entryId).set(entry)
        .then(() => {
            // Actualizar stock
            const newStock = inventory[itemIndex].stock + quantity;
            inventoryRef.child(itemId).update({ stock: newStock })
                .then(() => {
                    closeModal('entryModal');
                    showToast('✅ Entrada registrada');
                })
                .catch(error => alert('Error al actualizar stock: ' + error));
        })
        .catch(error => alert('Error al guardar entrada: ' + error));
}

// Ver detalles de entrada
function viewEntryDetails(id) {
    let entry = entries.find(e => e.id === id);
    if (!entry) return;
    
    let item = inventory.find(i => i.id === entry.itemId) || { name: "Desconocido" };
    
    let printWindow = window.open('', '_blank', 'width=800,height=600');
    printWindow.document.write(`
        <html>
        <head>
            <title>Vale de Entrada - ${entry.voucher}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 2rem; }
                .header { text-align: center; margin-bottom: 2rem; }
                .title { font-size: 1.5rem; font-weight: bold; }
                .subtitle { font-size: 1.2rem; margin-bottom: 1rem; }
                .details { width: 100%; border-collapse: collapse; margin-bottom: 2rem; }
                .details th, .details td { border: 1px solid #ddd; padding: 0.75rem; text-align: left; }
                .details th { background-color: #f2f2f2; }
                .signature { margin-top: 3rem; display: flex; justify-content: space-between; }
                .signature-box { width: 45%; border-top: 1px solid #000; padding-top: 0.5rem; }
                .footer { margin-top: 3rem; font-size: 0.8rem; text-align: center; }
                @media print { button { display: none; } }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="title">VALE DE ENTRADA DE INSUMOS BIOMÉDICOS</div>
                <div class="subtitle">Sub-almacén de insumos</div>
            </div>
            
            <table class="details">
                <tr>
                    <th>Folio Vale:</th>
                    <td>${entry.voucher}</td>
                </tr>
                <tr>
                    <th>Fecha:</th>
                    <td>${new Date(entry.date).toLocaleDateString()}</td>
                </tr>
                <tr>
                    <th>Insumo:</th>
                    <td>${item.name} (${item.id})</td>
                </tr>
                <tr>
                    <th>Cantidad:</th>
                    <td>${entry.quantity}</td>
                </tr>
            </table>
            
            <div class="signature">
                <div class="signature-box">
                    <strong>Recibí conforme:</strong><br><br>
                    Firma y sello
                </div>
                <div class="signature-box">
                    <strong>Autorizó:</strong><br><br>
                    Firma y sello
                </div>
            </div>
            
            <div class="footer">
                Sistema de Inventario Biomédico - ${new Date().toLocaleDateString()}
            </div>
            
            <script>
                window.onload = function() {
                    window.print();
                };
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// Cargar entradas en la tabla
function loadEntries() {
    let tableBody = document.getElementById('entriesTableBody');
    tableBody.innerHTML = '';
    
    entries.forEach(entry => {
        let item = inventory.find(i => i.id === entry.itemId) || { name: "Insumo no encontrado" };
        
        let row = document.createElement('tr');
        row.innerHTML = `
            <td>${entry.voucher || 'N/A'}</td>
            <td>${item.name}</td>
            <td>${entry.quantity}</td>
            <td>${entry.responsible || 'N/A'}</td>
            <td>${entry.date ? new Date(entry.date).toLocaleDateString() : 'N/A'}</td>
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

// Guardar salida
function saveOutput() {
    const itemId = document.getElementById('outputItem').value;
    const os = document.getElementById('outputOS').value;
    let engineer = document.getElementById('outputEngineer').value;
    const quantity = parseInt(document.getElementById('outputQuantity').value);
    const date = document.getElementById('outputDate').value;
    const movementType = document.getElementById('movementType').value;

    // Validar ingeniero manual
    if (engineer === 'OTRO') {
        engineer = document.getElementById('customEngineer').value.trim();
        if (!engineer) {
            alert('Por favor ingrese el nombre del ingeniero');
            return;
        }
    }

    if (!itemId || !os || !engineer || isNaN(quantity) || quantity <= 0 || !date) {
        alert('Complete los campos requeridos');
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
        date: new Date(date).toISOString(),
        movementType: movementType,
        status: movementType === 'loan' ? 'pending' : 'completed',
        isCustomEngineer: document.getElementById('outputEngineer').value === 'OTRO'
    };

    outputsRef.child(outputId).set(output)
        .then(() => {
            const newStock = item.stock - quantity;
            inventoryRef.child(itemId).update({ stock: newStock })
                .then(() => {
                    closeModal('outputModal');
                    showToast('Salida registrada');
                });
        })
        .catch(error => alert('Error: ' + error.message));
}


// Ver detalles de salida
function viewOutputDetails(id) {
    let output = outputs.find(o => o.id === id);
    if (!output) return;
    
    let item = inventory.find(i => i.id === output.itemId) || { name: "Desconocido" };
    
    let printWindow = window.open('', '_blank', 'width=800,height=600');
    printWindow.document.write(`
        <html>
        <head>
            <title>Vale de Salida - ${output.os}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 2rem; }
                .header { text-align: center; margin-bottom: 2rem; }
                .title { font-size: 1.5rem; font-weight: bold; }
                .subtitle { font-size: 1.2rem; margin-bottom: 1rem; }
                .details { width: 100%; border-collapse: collapse; margin-bottom: 2rem; }
                .details th, .details td { border: 1px solid #ddd; padding: 0.75rem; text-align: left; }
                .details th { background-color: #f2f2f2; }
                .signature { margin-top: 3rem; display: flex; justify-content: space-between; }
                .signature-box { width: 45%; border-top: 1px solid #000; padding-top: 0.5rem; }
                .footer { margin-top: 3rem; font-size: 0.8rem; text-align: center; }
                @media print { button { display: none; } }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="title">VALE DE SALIDA DE INSUMOS BIOMÉDICOS</div>
                <div class="subtitle">Sub-almacén de insumos</div>
            </div>
            
            <table class="details">
                <tr>
                    <th>Folio OS:</th>
                    <td>${output.os}</td>
                </tr>
                <tr>
                    <th>Fecha:</th>
                    <td>${new Date(output.date).toLocaleDateString()}</td>
                </tr>
                <tr>
                    <th>Insumo:</th>
                    <td>${item.name} (${item.id})</td>
                </tr>
                <tr>
                    <th>Cantidad:</th>
                    <td>${output.quantity}</td>
                </tr>
                <tr>
                    <th>Tipo de movimiento:</th>
                    <td>${output.movementType === 'loan' ? 'Préstamo' : 'Salida'}</td>
                </tr>
                <tr>
                    <th>Ingeniero solicitante:</th>
                    <td>${output.engineer}</td>
                </tr>
            </table>
            
            <div class="signature">
                <div class="signature-box">
                    <strong>Recibí conforme:</strong><br><br>
                    Firma y sello
                </div>
                <div class="signature-box">
                    <strong>Autorizó:</strong><br><br>
                    Firma y sello
                </div>
            </div>
            
            <div class="footer">
                Sistema de Inventario Biomédico - ${new Date().toLocaleDateString()}
            </div>
            
            <script>
                window.onload = function() {
                    window.print();
                };
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
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
    tableBody.innerHTML = '';
    
    outputs.forEach(output => {
        let item = inventory.find(i => i.id === output.itemId);
        if (!item) return;
        
        let row = document.createElement('tr');
        row.className = output.movementType === 'loan' ? 'loan-row' : '';
        row.innerHTML = `
            <td>${output.os}</td>
            <td>${item.name}</td>
            <td>${output.quantity}</td>
            <td>${output.engineer}</td>
            <td>${new Date(output.date).toLocaleDateString()}</td>
            <td class="action-buttons">
                <button class="btn btn-primary" onclick="viewOutputDetails('${output.id}')">Ver</button>
                ${output.movementType === 'loan' && output.status === 'pending' ? 
                 `<button class="btn btn-success" onclick="restoreLoan('${output.id}')">Restaurar</button>` : ''}
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
                    <input type="number" id="expiringDays" min="1" value="30">
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
            </tbody>
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

// Imprimir reporte
function printReport() {
    let printWindow = window.open('', '', 'width=800,height=600');
    printWindow.document.write('<html><head><title>Imprimir Reporte</title><style>body{font-family:Arial;}</style></head><body>');
    printWindow.document.write(document.getElementById('reportResults').innerHTML);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
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
    
    document.getElementById('movementDateFrom').value = firstDayOfMonth.toISOString().split('T')[0];
    document.getElementById('movementDateTo').value = today.toISOString().split('T')[0];
}
