document.getElementById("menuCreatePipeline").onclick = () => Pipe_Line_visible_block();
function Pipe_Line_visible_block () {

    // проверка существования узла
    let Check_Nodes = false;
    Engine.scene.children.forEach((child) => {        
        if (child.type === 'Node') {
            Check_Nodes = true;
        }
    });
    
    if (Check_Nodes) {    
        if (!Engine.selectedObject || Engine.selectedObject.type !== 'Node') {
            alert("Перед созданием трубопровода - выберите существующий узел!");
            return; 
        }
    }

    document.getElementById("pipelineBuilder").style.display = 'block';

    if (Engine.selectedObject && Engine.selectedObject.type === 'Node') {       
        
        // Получаем мировые координаты выделенного меша
        const selectedPos = Engine.selectedObject.position;
        
        // Автоматически заполняем инпуты в HTML координатами выделенного узла
        document.getElementById("pbCX").value = selectedPos.x;
        document.getElementById("pbCY").value = selectedPos.y;
        document.getElementById("pbCZ").value = selectedPos.z;
    } else {
                
        // Опционально: можно очищать инпуты, если до этого там что-то было
        document.getElementById("pbCX").value = 0;
        document.getElementById("pbCY").value = 0;
        document.getElementById("pbCZ").value = 0;
    }
    
    document.getElementById("pbConfirm").onclick = () => { 
        const pbCX = parseFloat(document.getElementById("pbCX").value);
        const pbCY = parseFloat(document.getElementById("pbCY").value);
        const pbCZ = parseFloat(document.getElementById("pbCZ").value);
        console.log("pbCX",pbCX);
        console.log("pbCY",pbCY);
        console.log("pbCZ",pbCZ);
        const pbDiameter = document.getElementById("pbDiameter").value;
        const activeAxis = document.querySelector('.axis-btn.active').dataset.axis;
        const pbLength = parseFloat(document.getElementById("pbLength").value);
        console.log("activeAxis",activeAxis);
        CreatePipeline(pbCX, pbCY, pbCZ, pbDiameter, pbLength, activeAxis, Check_Nodes);
    };
    document.getElementById("pbCancel").addEventListener("click", () => cancel());

    
};

function cancel() {
    document.getElementById("pipelineBuilder").style.display = 'none';        
}

// функция для создания трубопровода
function CreatePipeline (pbCX, pbCY, pbCZ, pbDiameter, pbLength, activeAxis, Check_Nodes) {
    // create_Pipe_line.style.display = 'block';
    const Node_Geometry = new THREE.SphereGeometry(2*pbDiameter/1000, 32, 32);
    const Node_Material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });    
    const Edge_Material = new THREE.MeshBasicMaterial({ color: '#0F1379' });
    if (Check_Nodes) {
        const [pbCX_end, pbCY_end, pbCZ_end] = calculation_end_node(pbCX, pbCY, pbCZ, pbLength, activeAxis)
        let Node_End; 

        const check_node_end = check_End_Node(pbCX_end, pbCY_end, pbCZ_end);
        console.log("check_node_end",check_node_end);
        if(check_node_end) {
            Node_End = check_node_end;
        }
        else{
            Node_End = new Node_new(Node_Geometry, Node_Material, 'Node');
            Node_End.position.set(pbCX_end, pbCY_end, pbCZ_end);
        }
            
        // console.log("Node_End",Node_End.position);
        // Node_Start.add(Node_End);
        const Node_Start = Engine.selectedObject;
        const path = new THREE.LineCurve3(Node_Start.position, Node_End.position);
        const Piepe_visible = new THREE.TubeGeometry (path, 64, pbDiameter/2/1000, 12, false);
        const Pipe_connection = new Edge_new(Piepe_visible, Edge_Material, Node_Start, Node_End);
        Node_Start.attach(Pipe_connection);
        Pipe_connection.attach(Node_End);
    }
    else {
        const Node_Start = new Node_new(Node_Geometry, Node_Material, 'Node');
        Node_Start.position.set(pbCX, pbCY, pbCZ);
        const [pbCX_end, pbCY_end, pbCZ_end] = calculation_end_node(pbCX, pbCY, pbCZ, pbLength, activeAxis)
        const Node_End = new Node_new(Node_Geometry, Node_Material, 'Node');
        Node_End.position.set(pbCX_end, pbCY_end, pbCZ_end);    
        // console.log("Node_End",Node_End.position);
        // Node_Start.add(Node_End);
        const path = new THREE.LineCurve3(Node_Start.position, Node_End.position)
        const Piepe_visible = new THREE.TubeGeometry (path, 64, pbDiameter/2/1000, 12, false)
        const Pipe_connection = new Edge_new(Piepe_visible, Edge_Material, Node_Start, Node_End);       
        Engine.scene.add(Node_Start);
        Node_Start.attach(Pipe_connection);
        Pipe_connection.attach(Node_End); 
        }
    

    
    // Engine.scene.add(Node_End);    
    // Engine.scene.add(Pipe_connection);

    console.log("Engine.scene.children",Engine.scene.children);
    console.log("STATE.Three_D_objects",STATE.Three_D_objects);
    cancel(); 
};

function calculation_end_node(pbCX, pbCY, pbCZ, pbLength, activeAxis){
    let nextX=0;
    let nextY=0;
    let nextZ=0;
    if (activeAxis==="x"){
        nextX = pbCX+pbLength;
        nextY = pbCY;
        nextZ = pbCZ;
    }
    else if(activeAxis==="y"){
        nextX = pbCX;
        nextY = pbCY+pbLength;
        nextZ = pbCZ;
    }
    else{
        nextX = pbCX;
        nextY = pbCY;
        nextZ = pbCZ+pbLength;
    }
    console.log("nextX",nextX)
    console.log("nextY",nextY)
    console.log("nextZ",nextZ)

    return [nextX, nextY, nextZ]; 
}


function check_End_Node(pbCX_end, pbCY_end, pbCZ_end){
    let foundNode = null;

    
    Engine.scene.traverse((child) => {
        if (child.type === 'Node') { 
            console.log("child.position.x111",child.position.x)
            console.log("child.position.y111",child.position.y) 
            console.log("child.position.z111",child.position.z)
            console.log("pbCX_end1111",pbCX_end)
            console.log("pbCY_end1111",pbCY_end) 
            console.log("pbCZ_end1111",pbCZ_end)              
            if (child.position.x === pbCX_end && child.position.y === pbCY_end && child.position.z === pbCZ_end) {
                console.log("child.position.x",child.position.x)
                console.log("child.position.y",child.position.y) 
                console.log("child.position.z",child.position.z)                  
                foundNode = child; 
            }
        }
    });
    return foundNode; 
}










// Код для перемещения модального окна
// const windowEl = document.getElementById('move_window');
// const handleEl = document.getElementById('pipelineDragHandle');
// const menuBtn = document.getElementById("menuCreatePipeline");

// // Функция открытия окна
// function CreatePipeline() {
//     windowEl.style.display = 'block';
// }

// // Привязка клика к кнопке меню
// if (menuBtn) {
//     menuBtn.onclick = () => CreatePipeline();
// }

// // Перетаскивание окон
// let isDragging = false;
// let offsetX = 0;
// let offsetY = 0;

// // 1. Клик по шапке — активируем перетаскивание
// handleEl.addEventListener('mousedown', (e) => {
//     if (e.button !== 0) return; // Игнорируем не левую кнопку мыши

//     isDragging = true;

//     // ВАЖНО: сбрасываем центрирование transform, переводя его в точные left/top,
//     // чтобы окно не прыгало при первом движении мыши.
//     if (windowEl.style.transform !== 'none') {
//         const rect = windowEl.getBoundingClientRect();
//         windowEl.style.left = `${rect.left + window.scrollX}px`;
//         windowEl.style.top = `${rect.top + window.scrollY}px`;
//         windowEl.style.transform = 'none';
//     }

//     // Вычисляем смещение курсора относительно угла окна
//     offsetX = e.clientX - windowEl.offsetLeft;
//     offsetY = e.clientY - windowEl.offsetTop;
// });

// // 2. Движение мыши по всему документу
// document.addEventListener('mousemove', (e) => {
//     if (!isDragging) return;

//     // Вычисляем новые координаты
//     let newLeft = e.clientX - offsetX;
//     let newTop = e.clientY - offsetY;

//     // Ограничиваем движение границами экрана (учитывая прокрутку страницы)
//     const minLeft = 0;
//     const maxLeft = document.documentElement.clientWidth - windowEl.offsetWidth;
//     const minTop = 0;
//     const maxTop = document.documentElement.clientHeight - windowEl.offsetHeight;

//     if (newLeft < minLeft) newLeft = minLeft;
//     if (newLeft > maxLeft) newLeft = maxLeft;
//     if (newTop < minTop) newTop = minTop;
//     if (newTop > maxTop) newTop = maxTop;

//     // Применяем новые стили
//     windowEl.style.left = `${newLeft}px`;
//     windowEl.style.top = `${newTop}px`;
// });

// // 3. Отпускаем мышь — сбрасываем флаг перетаскивания
// document.addEventListener('mouseup', () => {
//     isDragging = false;
// });