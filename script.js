/* =========================================================
   FORMATO DE MANTENIMIENTO DE EQUIPO BIOMÉDICO
   Lógica de la aplicación - JavaScript vanilla (ES6+)
   No requiere frameworks, librerías ni backend.
   ========================================================= */

(() => {
  'use strict';

  /* ---------------------------------------------------------
     Constantes y referencias generales
  --------------------------------------------------------- */
  const STORAGE_KEY = 'biomedicalMaintenanceFormats_v1';
  const LEGACY_STORAGE_KEY = 'biomedicalMaintenanceDraft_v1';
  const form = document.getElementById('maintenanceForm');

  let formats = [];
  let activeFormatId = 1;
  let nextFormatId = 1;
  let reviewMode = false;

  const activitiesBody = document.getElementById('activitiesBody');
  const partsBody = document.getElementById('partsBody');
  const toolsBody = document.getElementById('toolsBody');
  const photoGallery = document.getElementById('photoGallery');

  const STATUS_OPTIONS = ['Conforme', 'No conforme', 'No aplica'];

  /* ---------------------------------------------------------
     Utilidades genéricas
  --------------------------------------------------------- */

  // Crea un elemento a partir de HTML de forma segura para nodos únicos.
  function elementFromHTML(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstElementChild;
  }

  function todayISO() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function confirmAction(message) {
    return window.confirm(message);
  }

  /* ---------------------------------------------------------
     Renumeración de filas (columna "Ítem")
  --------------------------------------------------------- */
  function renumberRows(tbody, selector = '.item-number') {
    tbody.querySelectorAll('tr').forEach((row, index) => {
      const cell = row.querySelector(selector);
      if (cell) cell.textContent = index + 1;
    });
  }

  /* ---------------------------------------------------------
     TABLA: ACTIVIDADES REALIZADAS
  --------------------------------------------------------- */
  function createActivityRow() {
    const row = elementFromHTML(`
      <tr>
        <td class="item-number" data-label="Ítem">1</td>
        <td data-label="Actividad / componente"><textarea class="field-input" rows="2" placeholder="Actividad / componente inspeccionado"></textarea></td>
        <td data-label="Hallazgo / condición"><textarea class="field-input" rows="2" placeholder="Resultado / condición encontrada"></textarea></td>
        <td data-label="Estado">
          <select class="field-input">
            <option value="">Seleccione...</option>
            ${STATUS_OPTIONS.map((s) => `<option>${s}</option>`).join('')}
          </select>
        </td>
        <td data-label="Acción realizada"><textarea class="field-input" rows="2" placeholder="Acción realizada"></textarea></td>
        <td data-label="Observaciones"><textarea class="field-input" rows="2" placeholder="Observaciones"></textarea></td>
        <td class="col-actions no-print"><button type="button" class="row-delete-btn" title="Eliminar ítem">✕</button></td>
      </tr>
    `);
    row.querySelector('.row-delete-btn').addEventListener('click', () => {
      if (confirmAction('¿Desea eliminar esta actividad? Esta acción no se puede deshacer.')) {
        row.remove();
        renumberRows(activitiesBody);
        saveDraftSilently();
      }
    });
    return row;
  }

  function addActivityRow() {
    activitiesBody.appendChild(createActivityRow());
    renumberRows(activitiesBody);
  }

  /* ---------------------------------------------------------
     TABLA: REPUESTOS, COMPONENTES E INSUMOS
  --------------------------------------------------------- */
  function createPartRow() {
    const row = elementFromHTML(`
      <tr>
        <td class="item-number" data-label="Ítem">1</td>
        <td data-label="Descripción"><input type="text" class="field-input" placeholder="Descripción"></td>
        <td data-label="Marca / referencia"><input type="text" class="field-input" placeholder="Marca / referencia"></td>
        <td data-label="Cantidad"><input type="text" class="field-input" placeholder="Cant."></td>
        <td data-label="Unidad"><input type="text" class="field-input" placeholder="Unidad"></td>
        <td data-label="Observación"><input type="text" class="field-input" placeholder="Observación"></td>
        <td class="col-actions no-print"><button type="button" class="row-delete-btn" title="Eliminar">✕</button></td>
      </tr>
    `);
    row.querySelector('.row-delete-btn').addEventListener('click', () => {
      if (confirmAction('¿Desea eliminar este repuesto/insumo?')) {
        row.remove();
        renumberRows(partsBody);
        saveDraftSilently();
      }
    });
    return row;
  }

  function addPartRow() {
    partsBody.appendChild(createPartRow());
    renumberRows(partsBody);
  }

  /* ---------------------------------------------------------
     TABLA: EQUIPOS E INSTRUMENTOS UTILIZADOS
  --------------------------------------------------------- */
  function createToolRow() {
    const row = elementFromHTML(`
      <tr>
        <td data-label="Equipo / instrumento"><input type="text" class="field-input" placeholder="Equipo / instrumento"></td>
        <td data-label="Observaciones"><input type="text" class="field-input" placeholder="Observaciones"></td>
        <td class="col-actions no-print"><button type="button" class="row-delete-btn" title="Eliminar">✕</button></td>
      </tr>
    `);
    row.querySelector('.row-delete-btn').addEventListener('click', () => {
      if (confirmAction('¿Desea eliminar este instrumento?')) {
        row.remove();
        saveDraftSilently();
      }
    });
    return row;
  }

  function addToolRow() {
    toolsBody.appendChild(createToolRow());
  }

  /* ---------------------------------------------------------
     EVIDENCIA FOTOGRÁFICA
  --------------------------------------------------------- */
  function addPhotoItem(dataUrl, caption = '') {
    const emptyMsg = photoGallery.querySelector('.photo-empty');
    if (emptyMsg) emptyMsg.remove();

    const item = elementFromHTML(`
      <div class="photo-item">
        <button type="button" class="photo-remove-btn no-print" title="Eliminar fotografía">✕</button>
        <img src="${dataUrl}" alt="Evidencia fotográfica">
        <input type="text" class="photo-caption" placeholder="Descripción de la imagen" value="${caption.replace(/"/g, '&quot;')}">
      </div>
    `);
    item.querySelector('.photo-remove-btn').addEventListener('click', () => {
      if (confirmAction('¿Desea eliminar esta fotografía?')) {
        item.remove();
        saveDraftSilently();
      }
    });
    photoGallery.appendChild(item);
  }

  function handlePhotoFiles(fileList) {
    Array.from(fileList).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      const ownerId = activeFormatId;
      reader.onload = (e) => {
        if (ownerId === activeFormatId) {
          addPhotoItem(e.target.result);
          saveDraftSilently();
          return;
        }
        const owner = formats.find((item) => item.id === ownerId);
        if (owner) {
          owner.data.photos.push({ src: e.target.result, caption: '' });
          persistFormats();
          updateFormatNavigation();
        }
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---------------------------------------------------------
     LOGO Y FIRMAS (carga de imagen -> vista previa)
  --------------------------------------------------------- */
  function setupImageUpload({ inputId, previewId, placeholderId, removeBtnId, canvasId, boxId, errorId }) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    const placeholder = placeholderId ? document.getElementById(placeholderId) : null;
    const removeBtn = removeBtnId ? document.getElementById(removeBtnId) : null;
    const canvas = canvasId ? document.getElementById(canvasId) : null;
    const box = boxId ? document.getElementById(boxId) : null;
    const error = errorId ? document.getElementById(errorId) : null;
    const context = canvas ? canvas.getContext('2d') : null;
    let drawing = false;
    let hasStroke = false;

    function paintImage(dataUrl) {
      if (!canvas || !context) return;
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(canvas.clientWidth / image.width, canvas.clientHeight / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
        context.drawImage(image, (canvas.clientWidth - width) / 2, (canvas.clientHeight - height) / 2, width, height);
      };
      image.src = dataUrl;
    }

    function resizeCanvas() {
      if (!canvas || !context) return;
      const previous = preview && !preview.hidden ? preview.src : (hasStroke ? canvas.toDataURL('image/png') : '');
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      const ratio = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.lineWidth = 2.4;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.strokeStyle = '#172b3f';
      if (previous) paintImage(previous);
    }

    function clearCanvas() {
      if (!canvas || !context) return;
      context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      hasStroke = false;
    }

    function pointFromEvent(event) {
      const bounds = canvas.getBoundingClientRect();
      return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    }

    if (canvas && context) {
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);
      window.addEventListener('orientationchange', resizeCanvas);
      canvas.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        drawing = true;
        if (preview && !preview.hidden) preview.hidden = true;
        if (placeholder) placeholder.hidden = true;
        canvas.setPointerCapture(event.pointerId);
        const point = pointFromEvent(event);
        context.beginPath();
        context.moveTo(point.x, point.y);
      });
      canvas.addEventListener('pointermove', (event) => {
        if (!drawing) return;
        event.preventDefault();
        const point = pointFromEvent(event);
        context.lineTo(point.x, point.y);
        context.stroke();
        hasStroke = true;
      });
      const finishStroke = (event) => {
        if (!drawing) return;
        event.preventDefault();
        drawing = false;
        if (hasStroke) {
          showImage(canvas.toDataURL('image/png'));
          saveDraftSilently();
        }
      };
      canvas.addEventListener('pointerup', finishStroke);
      canvas.addEventListener('pointercancel', finishStroke);
    }

    function showImage(dataUrl) {
      preview.src = dataUrl;
      preview.hidden = false;
      if (placeholder) placeholder.hidden = true;
      if (removeBtn) removeBtn.hidden = false;
      if (box) box.classList.add('has-signature');
      if (error) {
        error.hidden = true;
        box.classList.remove('signature-invalid');
      }
      if (canvas) paintImage(dataUrl);
    }

    function clearImage() {
      preview.src = '';
      preview.hidden = true;
      if (placeholder) placeholder.hidden = false;
      if (removeBtn) removeBtn.hidden = true;
      if (box) {
        box.classList.remove('has-signature', 'signature-invalid');
      }
      if (error) error.hidden = true;
      clearCanvas();
      input.value = '';
    }

    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file || !file.type.startsWith('image/')) return;
      const reader = new FileReader();
      const ownerId = activeFormatId;
      reader.onload = (e) => {
        if (ownerId !== activeFormatId) {
          const owner = formats.find((item) => item.id === ownerId);
          if (owner) {
            owner.data.images = owner.data.images || {};
            owner.data.images[previewId] = e.target.result;
            persistFormats();
            updateFormatNavigation();
          }
          return;
        }
        showImage(e.target.result);
        saveDraftSilently();
      };
      reader.readAsDataURL(file);
    });

    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        const message = box && box.id === 'engineerSignatureBox'
          ? '¿Desea eliminar esta firma? El borrador guardado también se eliminará porque la firma es obligatoria.'
          : '¿Desea eliminar esta imagen?';
        if (confirmAction(message)) {
          clearImage();
          saveDraftSilently();
        }
      });
    }

    return { showImage, clearImage };
  }

  const signatureUpload = setupImageUpload({
    inputId: 'signatureInput',
    previewId: 'signaturePreview',
    placeholderId: 'signaturePlaceholder',
    removeBtnId: 'btnRemoveSignature',
    canvasId: 'signatureCanvas',
    boxId: 'engineerSignatureBox',
    errorId: 'engineerSignatureError',
  });

  const receiverSignatureUpload = setupImageUpload({
    inputId: 'receiverSignatureInput',
    previewId: 'receiverSignaturePreview',
    placeholderId: 'receiverSignaturePlaceholder',
    removeBtnId: 'btnRemoveReceiverSignature',
    canvasId: 'receiverSignatureCanvas',
    boxId: 'receiverSignatureBox',
  });

  /* ---------------------------------------------------------
     VALIDACIÓN DE CAMPOS IMPORTANTES
  --------------------------------------------------------- */
  function validateForm() {
    if (!validateEngineerSignature()) return false;

    const requiredFields = form.querySelectorAll('[data-required="true"]');
    let firstInvalid = null;

    requiredFields.forEach((field) => {
      const invalid = !field.value.trim();
      field.classList.toggle('field-invalid', invalid);
      if (invalid && !firstInvalid) firstInvalid = field;
    });

    if (firstInvalid) {
      firstInvalid.focus();
      window.alert('Por favor complete los campos obligatorios marcados con (*) antes de continuar.');
      return false;
    }
    return true;
  }

  function validateEngineerSignature() {
    const preview = document.getElementById('signaturePreview');
    if (preview && !preview.hidden && preview.src) return true;

    const box = document.getElementById('engineerSignatureBox');
    const error = document.getElementById('engineerSignatureError');
    box.classList.add('signature-invalid');
    error.hidden = false;
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('signatureCanvas').focus({ preventScroll: true });
    return false;
  }

  /* ---------------------------------------------------------
     GRUPOS DE SELECCIÓN (chips) - reemplazan a los radio buttons
     nativos para que la opción marcada se imprima de forma fiable.
  --------------------------------------------------------- */
  function initChoiceGroups() {
    form.querySelectorAll('.choice-group').forEach((group) => {
      group.addEventListener('click', (e) => {
        const btn = e.target.closest('.choice-btn');
        if (!btn || !group.contains(btn)) return;
        selectChoice(group, btn.dataset.value);
        saveDraftSilently();
      });
    });
  }

  function selectChoice(group, value) {
    const fieldName = group.dataset.choiceFor;
    const hiddenInput = form.querySelector(`input[type="hidden"][data-field="${fieldName}"]`);
    if (hiddenInput) hiddenInput.value = value;
    group.querySelectorAll('.choice-btn').forEach((b) => {
      b.classList.toggle('selected', b.dataset.value === value);
    });
  }

  // Refleja en los botones el valor guardado en el input oculto (carga de borrador/limpiar).
  function syncChoiceGroups() {
    form.querySelectorAll('.choice-group').forEach((group) => {
      const fieldName = group.dataset.choiceFor;
      const hiddenInput = form.querySelector(`input[type="hidden"][data-field="${fieldName}"]`);
      const value = hiddenInput ? hiddenInput.value : '';
      group.querySelectorAll('.choice-btn').forEach((b) => {
        b.classList.toggle('selected', Boolean(value) && b.dataset.value === value);
      });
    });
  }

  /* ---------------------------------------------------------
     SERIALIZACIÓN / DESERIALIZACIÓN DEL FORMULARIO (localStorage)
  --------------------------------------------------------- */
  function serializeForm() {
    const data = { fields: {}, activities: [], parts: [], tools: [], photos: [], images: {} };

    form.querySelectorAll('[data-field]').forEach((field) => {
      data.fields[field.dataset.field] = field.value;
    });

    activitiesBody.querySelectorAll('tr').forEach((row) => {
      const cells = row.querySelectorAll('textarea, select');
      data.activities.push(Array.from(cells).map((c) => c.value));
    });

    partsBody.querySelectorAll('tr').forEach((row) => {
      const cells = row.querySelectorAll('input');
      data.parts.push(Array.from(cells).map((c) => c.value));
    });

    toolsBody.querySelectorAll('tr').forEach((row) => {
      const cells = row.querySelectorAll('input');
      data.tools.push(Array.from(cells).map((c) => c.value));
    });

    photoGallery.querySelectorAll('.photo-item').forEach((item) => {
      const img = item.querySelector('img');
      const caption = item.querySelector('.photo-caption');
      data.photos.push({ src: img.src, caption: caption.value });
    });

    ['signaturePreview', 'receiverSignaturePreview'].forEach((id) => {
      const img = document.getElementById(id);
      if (img && !img.hidden && img.src) data.images[id] = img.src;
    });

    return data;
  }

  function resetFormData() {
    form.reset();
    form.querySelectorAll('.field-invalid').forEach((field) => field.classList.remove('field-invalid'));
    activitiesBody.innerHTML = '';
    partsBody.innerHTML = '';
    toolsBody.innerHTML = '';
    photoGallery.innerHTML = '';
    signatureUpload.clearImage();
    receiverSignatureUpload.clearImage();
    syncChoiceGroups();
    addActivityRow();
    showEmptyPhotoMessage();
    setDefaultDates();
  }

  function applyFormData(data) {
    if (!data) return;

    resetFormData();

    Object.entries(data.fields || {}).forEach(([name, value]) => {
      const field = form.querySelector(`[data-field="${name}"]`);
      if (field) field.value = value;
    });
    syncChoiceGroups();

    activitiesBody.innerHTML = '';
    (data.activities || []).forEach((values) => {
      const row = createActivityRow();
      const cells = row.querySelectorAll('textarea, select');
      values.forEach((v, i) => { if (cells[i]) cells[i].value = v; });
      activitiesBody.appendChild(row);
    });
    if (activitiesBody.children.length === 0) addActivityRow();
    renumberRows(activitiesBody);

    partsBody.innerHTML = '';
    (data.parts || []).forEach((values) => {
      const row = createPartRow();
      const cells = row.querySelectorAll('input');
      values.forEach((v, i) => { if (cells[i]) cells[i].value = v; });
      partsBody.appendChild(row);
    });
    renumberRows(partsBody);

    toolsBody.innerHTML = '';
    (data.tools || []).forEach((values) => {
      const row = createToolRow();
      const cells = row.querySelectorAll('input');
      values.forEach((v, i) => { if (cells[i]) cells[i].value = v; });
      toolsBody.appendChild(row);
    });

    photoGallery.innerHTML = '';
    (data.photos || []).forEach((p) => addPhotoItem(p.src, p.caption));
    if (photoGallery.children.length === 0) showEmptyPhotoMessage();

    if (data.images) {
      if (data.images.signaturePreview) signatureUpload.showImage(data.images.signaturePreview);
      if (data.images.receiverSignaturePreview) receiverSignatureUpload.showImage(data.images.receiverSignaturePreview);
    }
  }

  function getActiveFormat() {
    return formats.find((item) => item.id === activeFormatId);
  }

  function saveActiveFormat() {
    const active = getActiveFormat();
    if (active) active.data = serializeForm();
  }

  function persistFormats() {
    saveActiveFormat();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 2,
      activeId: activeFormatId,
      nextId: nextFormatId,
      formats,
    }));
  }

  function restoreFormatCollection(data) {
    let collection = data;
    if (!collection || !Array.isArray(collection.formats)) {
      if (!collection || !collection.fields) return false;
      collection = { activeId: 1, nextId: 2, formats: [{ id: 1, data: collection }] };
    }

    formats = collection.formats.map((item, index) => ({
      id: Number(item.id) > 0 ? Number(item.id) : index + 1,
      data: item.data || { fields: {}, activities: [], parts: [], tools: [], photos: [], images: {} },
    }));
    if (formats.length === 0) return false;

    const maxId = Math.max(...formats.map((item) => item.id));
    nextFormatId = Math.max(Number(collection.nextId) || 1, maxId + 1);
    activeFormatId = formats.some((item) => item.id === Number(collection.activeId))
      ? Number(collection.activeId)
      : formats[0].id;
    return true;
  }

  function hasEngineerSignature(data) {
    return Boolean(data && data.images && data.images.signaturePreview);
  }

  function isFormatComplete(item) {
    return Boolean(item && item.data && item.data.fields && item.data.fields.eqName && item.data.fields.eqName.trim() && hasEngineerSignature(item.data));
  }

  function getFormatStatus(item) {
    if (isFormatComplete(item)) return 'Firmado';
    if (item.data.fields && item.data.fields.eqName && item.data.fields.eqName.trim()) return 'Pendiente de firma';
    return 'Diligenciando';
  }

  function updateFormatNavigation() {
    const select = document.getElementById('formatSelect');
    select.replaceChildren();
    formats.forEach((item) => {
      const option = document.createElement('option');
      const name = item.data.fields && item.data.fields.eqName ? item.data.fields.eqName.trim() : '';
      option.value = String(item.id);
      option.textContent = `Formato #${item.id} · ${name || 'Sin equipo'} · ${getFormatStatus(item)}`;
      select.appendChild(option);
    });
    select.value = String(activeFormatId);
    document.getElementById('btnDeleteFormat').disabled = formats.length <= 1;

    const filled = formats.filter((item) => item.data.fields && item.data.fields.eqName && item.data.fields.eqName.trim()).length;
    const pending = formats.filter((item) => getFormatStatus(item) === 'Pendiente de firma').length;
    const signed = formats.filter(isFormatComplete).length;
    const clientSigned = formats.filter((item) => item.data.images && item.data.images.receiverSignaturePreview).length;
    document.getElementById('formatTotalCount').textContent = `${formats.length} formato${formats.length === 1 ? '' : 's'} creado${formats.length === 1 ? '' : 's'}`;
    document.getElementById('formatFilledCount').textContent = `${filled} diligenciado${filled === 1 ? '' : 's'}`;
    document.getElementById('formatPendingCount').textContent = `${pending} pendiente${pending === 1 ? '' : 's'} de firma`;
    document.getElementById('formatSignedCount').textContent = `${signed} firmado${signed === 1 ? '' : 's'}`;
    document.getElementById('formatClientSignedCount').textContent = `${clientSigned} firma${clientSigned === 1 ? '' : 's'} de cliente`;

    const overallStatus = document.getElementById('formatOverallStatus');
    const allComplete = formats.length > 0 && signed === formats.length;
    overallStatus.textContent = allComplete ? '✓ Todos los formatos están completos' : 'Hay formatos por completar o firmar';
    overallStatus.classList.toggle('is-complete', allComplete);

    const reviewNav = document.getElementById('formatReviewNav');
    reviewNav.hidden = !reviewMode;
    if (reviewMode) {
      const position = formats.findIndex((item) => item.id === activeFormatId);
      document.getElementById('formatReviewPosition').textContent = `Formato ${position + 1} de ${formats.length}`;
      document.getElementById('btnReviewPrevious').disabled = position <= 0;
      document.getElementById('btnReviewNext').textContent = position === formats.length - 1 ? 'Finalizar' : 'Siguiente →';
    }
  }

  function switchFormat(id) {
    const target = formats.find((item) => item.id === Number(id));
    if (!target || target.id === activeFormatId) return;
    clearTimeout(saveTimeout);
    saveActiveFormat();
    activeFormatId = target.id;
    applyFormData(target.data);
    updateFormatNavigation();
    saveDraftSilently();
  }

  function createFormat() {
    clearTimeout(saveTimeout);
    saveActiveFormat();
    const item = { id: nextFormatId++, data: null };
    formats.push(item);
    activeFormatId = item.id;
    resetFormData();
    item.data = serializeForm();
    updateFormatNavigation();
    persistFormats();
  }

  function deleteActiveFormat() {
    if (formats.length <= 1) return;
    const active = getActiveFormat();
    if (!confirmAction(`¿Desea eliminar el Formato #${active.id}? Esta acción no se puede deshacer.`)) return;
    const index = formats.indexOf(active);
    formats = formats.filter((item) => item !== active);
    const next = formats[Math.max(0, index - 1)];
    activeFormatId = next.id;
    applyFormData(next.data);
    updateFormatNavigation();
    persistFormats();
  }

  function startFormatReview() {
    saveActiveFormat();
    reviewMode = true;
    const firstPending = formats.find((item) => !isFormatComplete(item));
    if (firstPending && firstPending.id !== activeFormatId) switchFormat(firstPending.id);
    updateFormatNavigation();
    document.getElementById('sectionSignatures').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function finishFormatReview() {
    if (!validateForm()) return;
    saveActiveFormat();
    const incomplete = formats.find((item) => !isFormatComplete(item));
    if (incomplete) {
      window.alert(`El Formato #${incomplete.id} aún necesita información o la firma obligatoria del ingeniero.`);
      switchFormat(incomplete.id);
      document.getElementById('sectionSignatures').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    reviewMode = false;
    updateFormatNavigation();
    persistFormats();
    window.alert(`Los ${formats.length} formatos están completos y firmados por el ingeniero.`);
  }

  function moveReview(direction) {
    const index = formats.findIndex((item) => item.id === activeFormatId);
    if (direction > 0 && !validateForm()) return;
    saveActiveFormat();
    const target = formats[index + direction];
    if (direction > 0 && index === formats.length - 1) {
      finishFormatReview();
      return;
    }
    if (target) switchFormat(target.id);
  }

  function showEmptyPhotoMessage() {
    if (!photoGallery.querySelector('.photo-empty')) {
      photoGallery.appendChild(elementFromHTML('<p class="photo-empty">No se han agregado fotografías.</p>'));
    }
  }

  /* ---------------------------------------------------------
     GUARDAR / RECUPERAR BORRADOR (localStorage)
  --------------------------------------------------------- */
  let saveTimeout = null;
  function saveDraftSilently() {
    if (formats.length) {
      saveActiveFormat();
      updateFormatNavigation();
    }
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      try {
        persistFormats();
      } catch (err) {
        console.warn('No fue posible autoguardar el borrador:', err);
      }
    }, 400);
  }

  function saveDraft(showFeedback = true) {
    if (!validateEngineerSignature()) return;
    try {
      persistFormats();
      if (showFeedback) window.alert('Borrador guardado correctamente en este navegador.');
    } catch (err) {
      window.alert('No fue posible guardar el borrador. Es posible que el almacenamiento local esté lleno o deshabilitado.');
    }
  }

  function loadDraft(showFeedback = true) {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) {
      if (showFeedback) window.alert('No se encontró ningún borrador guardado.');
      return;
    }
    try {
      const saved = JSON.parse(raw);
      const currentId = activeFormatId;
      if (!restoreFormatCollection(saved)) throw new Error('Formato guardado no válido');
      const active = formats.find((item) => item.id === currentId) || getActiveFormat();
      activeFormatId = active.id;
      applyFormData(active.data);
      updateFormatNavigation();
      persistFormats();
      if (showFeedback) window.alert('Borrador recuperado correctamente.');
    } catch (err) {
      window.alert('El borrador guardado está dañado y no pudo recuperarse.');
    }
  }

  /* ---------------------------------------------------------
     LIMPIAR FORMULARIO
  --------------------------------------------------------- */
  function clearForm() {
    if (!confirmAction(`¿Está seguro de que desea limpiar el Formato #${activeFormatId}? Se perderá su información no guardada.`)) {
      return;
    }
    resetFormData();
    saveActiveFormat();
    updateFormatNavigation();
    persistFormats();
  }

  /* ---------------------------------------------------------
     FECHAS AUTOMÁTICAS
  --------------------------------------------------------- */
  function setDefaultDates() {
    const maintDate = form.querySelector('[data-field="maintDate"]');
    if (maintDate && !maintDate.value) maintDate.value = todayISO();
  }

  /* ---------------------------------------------------------
     DATOS PARAMETRIZADOS (config.js) - no editables en la página
  --------------------------------------------------------- */
  function renderConfig() {
    if (typeof APP_CONFIG === 'undefined') return;
    document.querySelectorAll('[data-config]').forEach((el) => {
      const value = APP_CONFIG[el.dataset.config];
      if (value !== undefined) el.textContent = value;
    });
    renderLogo();
  }

  // El logo es un archivo parametrizado en config.js, no un campo editable en la página.
  function renderLogo() {
    const logoPreview = document.getElementById('logoPreview');
    if (!logoPreview || !APP_CONFIG.logoPath) return;
    logoPreview.onerror = () => { logoPreview.hidden = true; };
    logoPreview.onload = () => { logoPreview.hidden = false; };
    logoPreview.src = APP_CONFIG.logoPath;
  }

  /* ---------------------------------------------------------
     VISTA PREVIA / IMPRESIÓN
  --------------------------------------------------------- */
  function updateFooterInfo() {
    const footerLine = document.getElementById('footerLine');
    const company = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.providerName) || 'Empresa / prestador del servicio';
    const docNumber = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.docNumber) || 'S/N';
    const docVersion = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.docVersion) || 'S/V';
    footerLine.textContent = `${company}  |  Código: ${docNumber}  |  Versión: ${docVersion}`;
  }

  function previewForm() {
    updateFooterInfo();
    document.getElementById('sheet').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function printForm() {
    if (!validateForm()) return;
    updateFooterInfo();
    window.print();
  }

  // Expande temporalmente las áreas de texto para que el contenido completo
  // se vea en la impresión/PDF en lugar de quedar recortado por el scroll.
  function expandTextareasForPrint() {
    form.querySelectorAll('textarea.field-input').forEach((el) => {
      el.dataset.originalHeight = el.style.height || '';
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    });
  }

  function restoreTextareasAfterPrint() {
    form.querySelectorAll('textarea.field-input').forEach((el) => {
      el.style.height = el.dataset.originalHeight || '';
      delete el.dataset.originalHeight;
    });
  }

  /* ---------------------------------------------------------
     EVENTOS GLOBALES
  --------------------------------------------------------- */
  function bindEvents() {
    document.getElementById('btnAddActivity').addEventListener('click', () => { addActivityRow(); saveDraftSilently(); });
    document.getElementById('btnAddPart').addEventListener('click', () => { addPartRow(); saveDraftSilently(); });
    document.getElementById('btnAddTool').addEventListener('click', () => { addToolRow(); saveDraftSilently(); });

    document.getElementById('btnAddPhoto').addEventListener('click', () => {
      document.getElementById('photoInput').click();
    });
    document.getElementById('photoInput').addEventListener('change', (e) => {
      handlePhotoFiles(e.target.files);
      e.target.value = '';
      saveDraftSilently();
    });

    document.getElementById('btnPreview').addEventListener('click', previewForm);
    document.getElementById('btnPrint').addEventListener('click', printForm);
    document.getElementById('btnPrintBottom').addEventListener('click', printForm);
    document.getElementById('formatSelect').addEventListener('change', (event) => switchFormat(event.target.value));
    document.getElementById('btnNewFormat').addEventListener('click', createFormat);
    document.getElementById('btnDeleteFormat').addEventListener('click', deleteActiveFormat);
    document.getElementById('btnReviewFormats').addEventListener('click', startFormatReview);
    document.getElementById('btnReviewPrevious').addEventListener('click', () => moveReview(-1));
    document.getElementById('btnReviewNext').addEventListener('click', () => moveReview(1));
    document.getElementById('btnExitReview').addEventListener('click', () => {
      reviewMode = false;
      updateFormatNavigation();
    });
    document.getElementById('btnSaveDraft').addEventListener('click', () => saveDraft(true));
    document.getElementById('btnLoadDraft').addEventListener('click', () => loadDraft(true));
    document.getElementById('btnClear').addEventListener('click', clearForm);

    // Autoguardado ante cualquier cambio en el formulario.
    form.addEventListener('input', saveDraftSilently);
    form.addEventListener('change', saveDraftSilently);

    window.addEventListener('beforeprint', () => {
      updateFooterInfo();
      expandTextareasForPrint();
    });
    window.addEventListener('afterprint', restoreTextareasAfterPrint);
  }

  /* ---------------------------------------------------------
     INICIALIZACIÓN
  --------------------------------------------------------- */
  function init() {
    bindEvents();
    initChoiceGroups();
    renderConfig();
    setDefaultDates();

    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    let restored = false;
    if (raw) {
      try {
        restored = restoreFormatCollection(JSON.parse(raw));
      } catch (err) {
        console.warn('No fue posible recuperar los formatos guardados:', err);
      }
    }

    if (restored) {
      applyFormData(getActiveFormat().data);
    } else {
      formats = [{ id: 1, data: null }];
      activeFormatId = 1;
      nextFormatId = 2;
      resetFormData();
    }

    updateFormatNavigation();
    persistFormats();
    updateFooterInfo();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
