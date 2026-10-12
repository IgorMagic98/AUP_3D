// Блок для отображения создания трубопровода.////////////////////////////////////////////////////////////////////////////////////////
document.getElementById("menuCreatePipeline").onclick = () => Pipe_Line_visible_block();
// Слушатель для разбиения трубопровода
document.getElementById("menuSplitPipeline").onclick = () => check_pipe_tube();
// Слушатель для редактирвоания трубопровода
document.getElementById("menuPipeline_Edit").onclick = () => check_pipe_tube_Edit();
// Слушатель для созданяи ветки
document.getElementById("menuCreateBranch").onclick = () => Check_CreateBranch();
// Запуск сбора инфы по объектам
document.getElementById("Add_list_object").onclick = () => Add_data_base();
// Временная проверка координат элементов
document.getElementById("Check_3D").onclick = () => logPipelineTree();
// Проверка существования начального узала
// Если существует необходимо выбрать узел привязки
// массив для передачи на бэкэнд

// Функция для сбора информации из объектов
function Add_data_base () {
    const Data_base = {
        Node: [],
        Edge: []
    };
    Engine.scene.traverse((child) => {    
        if (typeof child.add_list === 'function') {
            if (child.type === 'Edge') {
                const properties = child.add_list();
                Data_base.Edge.push(properties);
            }
            else {
                const properties = child.add_list();
                Data_base.Node.push(properties);
            }
            // console.log("child_data_base", child)
            // const properties = child.add_list();
            
        }       
    });
    // Data_base.push(Node);
    // Data_base.push(Edge);
    console.log("Data_base для отправки на бэкэнд", Data_base)
    sendJson(Data_base);
}

function Pipe_Line_visible_block () {
    // проверка существования узла
    let Check_Nodes = false;
    Engine.scene.traverse((child) => {       
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
        // создаем вектор для записи мировых координат выделенного объекта
        const selected_World_Pos = new THREE.Vector3();
        // Получаем мировые координаты выделенного объекта
        Engine.selectedObject.getWorldPosition(selected_World_Pos);
        // Получаем мировые координаты выделенного меша
        // const selectedPos = Engine.selectedObject.position;
        
        // Автоматически заполняем инпуты в HTML координатами выделенного узла
        document.getElementById("pbCX").value = selected_World_Pos.x;
        document.getElementById("pbCY").value = selected_World_Pos.y;
        document.getElementById("pbCZ").value = selected_World_Pos.z;
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
        const pbDiameter = parseFloat(document.getElementById("pbDiameter").value);
        const activeAxis = document.querySelector('.axis-btn.active').dataset.axis;
        const pbLength = parseFloat(document.getElementById("pbLength").value);
        console.log("activeAxis",activeAxis);
        CreatePipeline(pbCX, pbCY, pbCZ, pbDiameter, pbLength, activeAxis, Check_Nodes);
    };
    // document.getElementById("pbCancel").addEventListener("click", () => cancel("pipelineBuilder"));
    document.getElementById("pbCancel").onclick = () => cancel("pipelineBuilder");    
};
// \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
// Функция закрытия модального окна создания 
function cancel(name) {
    document.getElementById(name).style.display = 'none';        
}

// функция для создания трубопровода, включена рповерка начальных условий при выборре узла, и проверка конечной точки при совпадении координат
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
            Node_End = new Node_new(Node_Geometry, Node_Material, 'Node' );
            Node_End.position.set(pbCX_end, pbCY_end, pbCZ_end);
        }
            
        // console.log("Node_End",Node_End.position);
        // Node_Start.add(Node_End);
        const Node_Start = Engine.selectedObject;

        const start_World_Pos = new THREE.Vector3();
        Node_Start.getWorldPosition(start_World_Pos);

        const end_World_pos = new THREE.Vector3();
        Node_End.getWorldPosition(end_World_pos);

        const path = new THREE.LineCurve3(start_World_Pos, end_World_pos);
        const Piepe_visible = new THREE.TubeGeometry (path, 64, pbDiameter/2/1000, 12, false);
        const Pipe_connection = new Edge_new(Piepe_visible, Edge_Material, Node_Start, Node_End, 'Edge', pbLength, pbDiameter);
        Node_Start.attach(Pipe_connection);
        if (!check_node_end) {
            Pipe_connection.attach(Node_End);
        }
    }
    else {
        const Node_Material_start = new THREE.MeshBasicMaterial({ color: 0x800080 });
        const Node_Start = new Node_new(Node_Geometry, Node_Material_start, 'Source');
        Node_Start.position.set(pbCX, pbCY, pbCZ);
        const [pbCX_end, pbCY_end, pbCZ_end] = calculation_end_node(pbCX, pbCY, pbCZ, pbLength, activeAxis)
        const Node_End = new Node_new(Node_Geometry, Node_Material, 'Node');
        Node_End.position.set(pbCX_end, pbCY_end, pbCZ_end);    
        // console.log("Node_End",Node_End.position);
        // Node_Start.add(Node_End);
        const path = new THREE.LineCurve3(Node_Start.position, Node_End.position)
        const Piepe_visible = new THREE.TubeGeometry (path, 64, pbDiameter/2/1000, 12, false)
        const Pipe_connection = new Edge_new(Piepe_visible, Edge_Material, Node_Start, Node_End, 'Edge', pbLength, pbDiameter);       
        Engine.scene.add(Node_Start);
        Node_Start.attach(Pipe_connection);
        Pipe_connection.attach(Node_End); 
        }    
    // Engine.scene.add(Node_End);    
    // Engine.scene.add(Pipe_connection);
    update_Node_XYZ()
    console.log("Engine.scene.children",Engine.scene.children);
    console.log("STATE.Three_D_objects",STATE.Three_D_objects);
    cancel("pipelineBuilder"); 
};
// Функция расчета коенчного узла для трубопровода
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
    // console.log("nextX",nextX)
    // console.log("nextY",nextY)
    // console.log("nextZ",nextZ)
    return [nextX, nextY, nextZ]; 
}

// функция првоерки координат для конечного узла трубопровода
function check_End_Node(pbCX_end, pbCY_end, pbCZ_end){
    let foundNode = null;    
    Engine.scene.traverse((child) => {
        if (child.type === 'Node') { 
            const child_World_Pos = new THREE.Vector3();
            child.getWorldPosition(child_World_Pos);
            // console.log("child.position.x111",child.position.x)
            // console.log("child.position.y111",child.position.y) 
            // console.log("child.position.z111",child.position.z)
            // console.log("pbCX_end1111",pbCX_end)
            // console.log("pbCY_end1111",pbCY_end) 
            // console.log("pbCZ_end1111",pbCZ_end)              
            if (child_World_Pos.x === pbCX_end && child_World_Pos.y === pbCY_end && child_World_Pos.z === pbCZ_end) {
                // console.log("child.position.x",child.position.x)
                // console.log("child.position.y",child.position.y) 
                // console.log("child.position.z",child.position.z)                  
                foundNode = child; 
            }
        }
    });
    return foundNode; 
}

// Првоерка выбранной трубы
function check_pipe_tube_Edit(){
    // проверка существования трубопровода
    // alert("внутри функции разбиения")
    let Check_tube = false;
    Engine.scene.traverse((child) => {       
        if (child.type === 'Edge') {
            Check_tube = true;
        }        
    });    
    if (Check_tube) {    
        if (!Engine.selectedObject || Engine.selectedObject.type !== 'Edge') {
            alert("Перед редактированием выберите турбопровод!");
            return; 
        }
    }
    else{
        alert("Создайте и выберите трубопровод!")
        return;
    }

    document.getElementById("PipelineModal_Edit").style.display = 'block';
    document.getElementById("number_pipe_edit").innerText = `${ Engine.selectedObject.name} id: ${Engine.selectedObject.id}`;
    document.getElementById("Length_pipe_edit").innerText = Engine.selectedObject.Length;
    
    // console.log("Engine.selectedObject",Engine.selectedObject);

    // document.getElementById("splitCancelBtn_Edit").addEventListener("click", () => cancel("PipelineModal_Edit"));
    // document.getElementById("splitApplyBtn_Edit").addEventListener("click", () => edit_pipe_tube(Engine.selectedObject));
    document.getElementById("splitCancelBtn_Edit").onclick = () => cancel("PipelineModal_Edit");
    document.getElementById("splitApplyBtn_Edit").onclick = () => edit_pipe_tube(Engine.selectedObject);
    
}

function edit_pipe_tube(Edge) {
    let start_node = Edge.start_node;
    let end_node = Edge.end_node;

    const new_long = parseFloat(document.getElementById("pipe_edit").value);
    
    const start_World_Pos = new THREE.Vector3();
    const end_World_Pos = new THREE.Vector3();
    // берем мирвоые позиции из локальных объекта 
    start_node.getWorldPosition(start_World_Pos);
    end_node.getWorldPosition(end_World_Pos);
    // преобразованеи вектора в 1
    const direction_Vector = new THREE.Vector3();
    direction_Vector.subVectors(end_World_Pos, start_World_Pos).normalize();
    // расчет положение точки end
    const new_World_End = new THREE.Vector3();
    new_World_End.addVectors(start_World_Pos, direction_Vector.multiplyScalar(new_long));
    
    const local_End_Node = new_World_End.clone();    
    // Переход из мировых координат в локальыне рордителя
    if (end_node.parent) {
        end_node.parent.worldToLocal(local_End_Node);
    }
    
    end_node.position.copy(local_End_Node);
    // end_node.X_gl = new_World_End.x;
    // end_node.Y_gl = new_World_End.y;
    // end_node.Z_gl = new_World_End.z;

    // start_node.X_gl = start_World_Pos.x;
    // start_node.Y_gl = start_World_Pos.y;
    // start_node.Z_gl = start_World_Pos.z;    
    

    end_node.updateMatrixWorld(true); 
    start_node.updateMatrixWorld(true);
    Edge.updateMatrixWorld(true);

    // обновление отображения ребра
    const path_Start = start_World_Pos.clone();
    const path_End = new_World_End.clone();

    Edge.worldToLocal(path_Start);
    Edge.worldToLocal(path_End);
    
    const new_Path = new THREE.LineCurve3(path_Start, path_End);
        
    Edge.geometry.dispose(); 
    Edge.geometry = new THREE.TubeGeometry(new_Path, 64, Edge.DN / 2 / 1000, 12, false);
    Edge.Length = new_long;
    
    cancel("PipelineModal_Edit");

    update_Node_XYZ();

    console.log("Engine.scene.children_EDIT",Engine.scene.children);



}

function update_Node_XYZ(){
    Engine.scene.traverse((child) => {    
        if (child.name === 'Node_new') {
                        
            child.update_Global(); 
            
        }
    });
    console.log("Engine.scene.children_update_Node_XYZ",Engine.scene.children);
}

function Check_CreateBranch(){
    // проверка существования узла
    // alert("внутри функции разбиения")
    let Check_node = false;
    Engine.scene.traverse((child) => {       
        if (child.type === 'Node') {
            Check_node = true;
        }        
    });    
    if (Check_node) {    
        if (!Engine.selectedObject || Engine.selectedObject.type !== 'Node') {
            alert("Выберите узел привязки!");
            return; 
        }
    }
    else{
        alert("Создайте и выберите узел!")
        return;
    }

    document.getElementById("createBranchModal").style.display = 'block';
    document.getElementById("createBranchCancelBtn").onclick = () => cancel("createBranchModal");

    // const Count = parseFloat(document.getElementById("createBranchSprCount").value);

    document.getElementById("createBranchApplyBtn").onclick = () => create_branch(Engine.selectedObject);
    // cancel("createBranchModal");
}



function create_branch(Node) {
    const Count = parseFloat(document.getElementById("createBranchSprCount").value);
    const activeAxis = document.querySelector('#createBranchModal .axis-btn.active').dataset.axis;
    // const Node_Start = Engine.selectedObject;
    // создание контейнера для мировых координат
    const start_World_Pos = new THREE.Vector3();
    Node.getWorldPosition(start_World_Pos);
    // Мировые координаты начального узла
    let currentX = start_World_Pos.x;
    let currentY = start_World_Pos.y;
    let currentZ = start_World_Pos.z;
    // Дефолтный материал
    const Node_Geometry = new THREE.SphereGeometry(2 * 50 / 1000, 32, 32);
    const Node_Material = new THREE.MeshBasicMaterial({ color: '#FF0000' });    
    const Edge_Material = new THREE.MeshBasicMaterial({ color: '#0F1379' });

    
    
    
    let currentStartNode = Node;
    // Цикл для создания ветвей и новых оросителей
    for (let i = 0; i < Count; i++) {
        
        const [pbCX_end, pbCY_end, pbCZ_end] = calculation_end_node(currentX, currentY, currentZ, 2, activeAxis);
        
        let currentEndNode;
        // проверка на созданные орсоители пока не нужна 
        // const check_node_end = check_End_Node(pbCX_end, pbCY_end, pbCZ_end);
        // if (check_node_end) {
        //     currentEndNode = check_node_end;
        // } else {            
        //     currentEndNode = new Node_new(Node_Geometry, Node_Material, 'Sprinkler');
        //     currentEndNode.position.set(pbCX_end, pbCY_end, pbCZ_end);
        // }
        // Просто создаем новые узлы с типом орсоитель
        currentEndNode = new Node_new(Node_Geometry, Node_Material, 'Sprinkler');
        currentEndNode.position.set(pbCX_end, pbCY_end, pbCZ_end);

        const step_Start_Pos = new THREE.Vector3();
        currentStartNode.getWorldPosition(step_Start_Pos);

        const step_End_Pos = new THREE.Vector3();
        currentEndNode.getWorldPosition(step_End_Pos);
        
        const path = new THREE.LineCurve3(step_Start_Pos, step_End_Pos);
        const Pipe_visible = new THREE.TubeGeometry(path, 64, 50 / 2 / 1000, 12, false);
                
        const Pipe_connection = new Edge_new(Pipe_visible, Edge_Material, currentStartNode, currentEndNode, 'Edge', 2, 50);
        
        currentStartNode.attach(Pipe_connection);
        Pipe_connection.attach(currentEndNode);
                
        currentStartNode = currentEndNode;
                
        currentX = pbCX_end;
        currentY = pbCY_end;
        currentZ = pbCZ_end;
    }
    
    console.log("Engine.scene.children", Engine.scene.children);
    cancel("createBranchModal");
    update_Node_XYZ()


}


// Првоерка выбранной трубы
function check_pipe_tube(){
    // проверка существования трубопровода
    // alert("внутри функции разбиения")
    let Check_tube = false;
    Engine.scene.traverse((child) => {       
        if (child.type === 'Edge') {
            Check_tube = true;
        }        
    });    
    if (Check_tube) {    
        if (!Engine.selectedObject || Engine.selectedObject.type !== 'Edge') {
            alert("Перед разбиением выберите турбопровод!");
            return; 
        }
    }
    else{
        alert("Создайте и выберите трубопровод!")
        return;
    }

    document.getElementById("splitPipelineModal").style.display = 'block';
    document.getElementById("number_pipe_break").innerText = `${ Engine.selectedObject.name} id: ${Engine.selectedObject.id}`;
    document.getElementById("Length_pipe_break").innerText = Engine.selectedObject.Length;
    
    console.log("Engine.selectedObject",Engine.selectedObject);

    // document.getElementById("splitCancelBtn").addEventListener("click", () => cancel("splitPipelineModal"));
    // document.getElementById("splitApplyBtn").addEventListener("click", () => broken_pipe_tube());
    
}

function broken_pipe_tube() {

};



async function sendJson(v) {
        // console.log("vvvvvvvvvvvvvvvvv",v)
        // const v = document.getElementById('graphJsonOutput').value;
    try {
            const response = await fetch('api/sole/', {
            method: 'POST', // Метод запроса
            headers: {
                'Content-Type': 'application/json;charset=utf-8' // Указываем тип данных
        },
        body: JSON.stringify(v)
        });
                if (!response.ok) {
                throw new Error(`Ошибка HTTP: ${response.status}`);
                }
                const result = await response.json(); // Читаем ответ сервера в формате JSON
                console.log('Ответ от сервера:', result);
            } catch (error) {
                console.error('Ошибка при отправке запроса:', error);
            }
};








// функция для контроля узлов отработка 
function logPipelineTree() {
    console.log("=== ОТЧЕТ ПО ТРУБОПРОВОДНОЙ СЕТИ ===");
    
    let edgeCount = 0;

    // Проходим по всем объектам на сцене Three.js
    Engine.scene.traverse((object) => {
        // Проверяем, что объект является трубой (Edge)
        // (Здесь используется проверка типа, как у вас в коде 'Edge' или по вашему классу Edge_new)
        if (object.type === 'Edge' || object.name === 'Edge_new') {
            edgeCount++;
            
            const startNode = object.start_node;
            const endNode = object.end_node;

            // Создаем пустые векторы для сбора РЕАЛЬНЫХ мировых координат
            const startWorldPos = new THREE.Vector3();
            const endWorldPos = new THREE.Vector3();

            // Если узлы привязаны к трубе, вытаскиваем их глобальные позиции
            if (startNode) startNode.getWorldPosition(startWorldPos);
            if (endNode) endNode.getWorldPosition(endWorldPos);

            // Получаем зафиксированную длину из свойств объекта (или считаем расстояние между мировыми точками)
            const savedLength = object.Length; 
            const realLength = startWorldPos.distanceTo(endWorldPos); // Честное расстояние в 3D мире

            console.group(`Трубопровод №${edgeCount} [ID: ${object.uuid || 'нет'}]`);
            console.log(`Диаметр (DN): %c${object.DN || 'Не указан'} мм`, "color: #007bff; font-weight: bold;");
            console.log(`Сохраненная длина (.Length): %c${savedLength ? savedLength.toFixed(3) : 'нет'} м`, "color: #ffc107; font-weight: bold;");
            console.log(`Реальное расстояние на сцене: %c${realLength.toFixed(3)} м`, "color: #28a745; font-weight: bold;");
            
            if (startNode) {
                console.log(`  📍 НАЧАЛО (Узел): [ X: ${startWorldPos.x.toFixed(3)}, Y: ${startWorldPos.y.toFixed(3)}, Z: ${startWorldPos.z.toFixed(3)} ]`);
            } else {
                console.log(`  📍 НАЧАЛО (Узел): %cНЕ НАЙДЕН`, "color: red;");
            }

            if (endNode) {
                console.log(`  📍 КОНЕЦ  (Узел): [ X: ${endWorldPos.x.toFixed(3)}, Y: ${endWorldPos.y.toFixed(3)}, Z: ${endWorldPos.z.toFixed(3)} ]`);
            } else {
                console.log(`  📍 КОНЕЦ  (Узел): %cНЕ НАЙДЕН`, "color: red;");
            }
            console.groupEnd();
        }
    });

    if (edgeCount === 0) {
        console.log("Трубопроводы на сцене не найдены.");
    }
    console.log("====================================");
}