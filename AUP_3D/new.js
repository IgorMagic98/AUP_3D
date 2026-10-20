// Блок для отображения создания трубопровода.////////////////////////////////////////////////////////////////////////////////////////
document.getElementById("menuCreatePipeline").onclick = () => Pipe_Line_visible_block();
// Слушатель для удаления трубопровода
document.getElementById("delete_SplitPipeline").onclick = () => delete_pipe_tube();
// Слушатель для редактирвоания трубопровода
document.getElementById("menuPipeline_Edit").onclick = () => check_pipe_tube_Edit();
// Слушатель для созданяи ветки
document.getElementById("menuCreateBranch").onclick = () => Check_CreateBranch();
// Запуск сбора инфы по объектам
document.getElementById("Add_list_object").onclick = () => Add_data_base();
// Временная проверка координат элементов
document.getElementById("Check_3D").onclick = () => logPipelineTree();

// Слушатель для экспорта JSON
document.getElementById("menuExportJSON").onclick = () => exportToJSON();

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
    // sendJson(Data_base);
    sendJsonAndVisualize(Data_base);
}
function Check_nodes_scene() {
    // проверка существования узла
    let Check_Nodes = false;
    Engine.scene.traverse((child) => {       
        if (child.type === 'Node') {
            Check_Nodes = true;
        }
    });    
    // if (Check_Nodes) {    
    //     if (!Engine.selectedObject || (Engine.selectedObject.type !== 'Node' && Engine.selectedObject.type !== 'Sprinkler')) {
    //         alert("Перед созданием трубопровода - выберите существующий узел!");
    //         return true; 
    //     }
    // }
    return Check_Nodes;
}
// функция для вклчюения отображения блока созданяи ветки
function Pipe_Line_visible_block () {
    let Check_Nodes = Check_nodes_scene();
    if (Check_Nodes) {    
        if (!Engine.selectedObject || (Engine.selectedObject.type !== 'Node' && Engine.selectedObject.type !== 'Sprinkler')) {
            alert("Перед созданием трубопровода - выберите существующий узел!");
            return; 
        }
    }
    document.getElementById("pipelineBuilder").style.display = 'block';
    document.body.classList.add('builder-active');
    // логика вызова данных дял определенного DN определенного типа трубопровода    
    // if (Engine.selectedObject && Engine.selectedObject.type === 'Node'||Engine.selectedObject && Engine.selectedObject.type === 'Sprinkler') { 
    //     // создаем вектор для записи мировых координат выделенного объекта
    //     const selected_World_Pos = new THREE.Vector3();
    //     // Получаем мировые координаты выделенного объекта
    //     Engine.selectedObject.getWorldPosition(selected_World_Pos);
    //     // Получаем мировые координаты выделенного меша
    //     // const selectedPos = Engine.selectedObject.position;        
    //     // Автоматически заполняем инпуты в HTML координатами выделенного узла
    //     document.getElementById("pbCX").value = selected_World_Pos.x;
    //     document.getElementById("pbCY").value = selected_World_Pos.y;
    //     document.getElementById("pbCZ").value = selected_World_Pos.z;
    // } else {             
    //     document.getElementById("pbCX").value = 0;
    //     document.getElementById("pbCY").value = 0;
    //     document.getElementById("pbCZ").value = 0;
    // }    
    document.getElementById("pbConfirm").onclick = () => {
        let Check_Nodes_click = Check_nodes_scene();
        if (Check_Nodes_click) {  
            Check_Nodes = true;
            if (!Engine.selectedObject || (Engine.selectedObject.type !== 'Node' && Engine.selectedObject.type !== 'Sprinkler')) {
                alert("Перед созданием трубопровода - выберите существующий узел!");
                return; 
            }
        }
        
        // if (!Engine.selectedObject) {
        //     alert("Перед созданием трубопровода - выберите существующий узел!");
        // }
        const pbCX = parseFloat(document.getElementById("pbCX").value);
        const pbCY = parseFloat(document.getElementById("pbCY").value);
        const pbCZ = parseFloat(document.getElementById("pbCZ").value);        
        
        const activeAxis = document.querySelector('.axis-btn.active').dataset.axis; // активная ось направления
        const activeAxis_direction = document.querySelector('.dir-btn.active').dataset.dir; // активное положение направления
        const pbLength = parseFloat(document.getElementById("pbLength").value);
        const activeAxis_rotation = document.querySelector('.axis-btn-rot.active').dataset.axis; // активная ось дял порворота
        const rotate_value = parseFloat(document.getElementById("pbAngle").value);

        const type_tube = document.getElementById("get_tube_pipe").selectedOptions[0].textContent; // тип трубы (ГОСТ)
        
        const pbDiameter = document.getElementById("pbDiameter"); //// элемент для удосбвтва вывода свойств
        const DN_tube = parseFloat(pbDiameter.selectedOptions[0].textContent); ///// сами свойства
        const k_t = parseFloat(pbDiameter.selectedOptions[0].dataset.k_t);
        const kvelocity = parseFloat(pbDiameter.selectedOptions[0].dataset.kvelocity);
        // console.log("type_tube",type_tube);
        // console.log("=== ДАННЫЕ ДЛЯ СОЗДАНИЯ ТРУБОПРОВОДА ===");
        // console.table({
        //     "Координата X": pbCX,
        //     "Координата Y": pbCY,
        //     "Координата Z": pbCZ,
        //     "Ось направления": activeAxis,
        //     "Знак направления": activeAxis_direction,
        //     "Длина участка (м)": pbLength,
        //     "Ось вращения вокруг": activeAxis_rotation,
        //     "Угол поворота (град)": rotate_value,
        //     "Гост на трубы": type_tube,
        //     "Номинальный ДН трубы": DN_tube,
        //     "Коэффициент k_t": k_t,
        //     "Коэффициент kvelocity": kvelocity
        // });
        CreatePipeline(pbCX, pbCY, pbCZ, activeAxis, activeAxis_direction, pbLength, activeAxis_rotation, rotate_value, type_tube, 
            DN_tube, k_t, kvelocity, Check_Nodes);
    };
    // document.getElementById("pbCancel").addEventListener("click", () => cancel("pipelineBuilder"));
    document.getElementById("pbCancel").onclick = () => cancel("pipelineBuilder");    
};
// \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
// Функция закрытия модального окна создания 
function cancel(name) {
    document.getElementById(name).style.display = 'none';
    document.body.classList.remove('builder-active');        
}

// функция для создания трубопровода, включена поверка начальных условий при выборре узла, и проверка конечной точки при совпадении координат
function CreatePipeline (pbCX, pbCY, pbCZ, activeAxis, activeAxis_direction, pbLength, activeAxis_rotation, rotate_value, type_tube,
            pbDiameter, k_t, kvelocity, Check_Nodes) {
    // create_Pipe_line.style.display = 'block';
    // console.log("activeAxis_direction1488888",activeAxis_direction);
    const Node_Geometry = new THREE.SphereGeometry(2*pbDiameter/1000, 32, 32);
    const Node_Material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });    
    const Edge_Material = new THREE.MeshBasicMaterial({ color: '#0F1379' });
    console.log("Check_Nodes_121123",Check_Nodes)
    if (Check_Nodes) {
        const [pbCX_end, pbCY_end, pbCZ_end] = calculation_end_node(pbCX, pbCY, pbCZ, pbLength, activeAxis, activeAxis_direction,
            activeAxis_rotation,rotate_value)
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
        const Pipe_connection = new Edge_new(Piepe_visible, Edge_Material, Node_Start, Node_End, 'Edge', pbLength, pbDiameter, type_tube, k_t, kvelocity );
        Node_Start.attach(Pipe_connection);
        if (!check_node_end) {
            Pipe_connection.attach(Node_End);
        }
    }
    else {
        const Node_Material_start = new THREE.MeshBasicMaterial({ color: 0x800080 });
        const Node_Start = new Node_new(Node_Geometry, Node_Material_start, 'Source');
        Node_Start.position.set(pbCX, pbCY, pbCZ);
        const [pbCX_end, pbCY_end, pbCZ_end] = calculation_end_node(pbCX, pbCY, pbCZ, pbLength, activeAxis, activeAxis_direction,
            activeAxis_rotation,rotate_value)
        const Node_End = new Node_new(Node_Geometry, Node_Material, 'Node');
        Node_End.position.set(pbCX_end, pbCY_end, pbCZ_end);    
        // console.log("Node_End",Node_End.position);
        // Node_Start.add(Node_End);
        const path = new THREE.LineCurve3(Node_Start.position, Node_End.position)
        const Piepe_visible = new THREE.TubeGeometry (path, 64, pbDiameter/2/1000, 12, false)
        const Pipe_connection = new Edge_new(Piepe_visible, Edge_Material, Node_Start, Node_End, 'Edge', pbLength, pbDiameter, type_tube, k_t, kvelocity);       
        Engine.scene.add(Node_Start);
        Node_Start.attach(Pipe_connection);
        Pipe_connection.attach(Node_End); 
        }    
    // Engine.scene.add(Node_End);    
    // Engine.scene.add(Pipe_connection);
    update_Node_XYZ()
    console.log("Engine.scene.children",Engine.scene.children);
    console.log("STATE.Three_D_objects",STATE.Three_D_objects);
    updateTreeUI(); // Обновить дерево построения
    // cancel("pipelineBuilder"); 
};
// Функция расчета коенчного узла для трубопровода
function calculation_end_node(pbCX, pbCY, pbCZ, pbLength, activeAxis, activeAxis_direction,
    activeAxis_rotation,rotate_value)
    {
        let symbol = (activeAxis_direction === "+") ? 1 : -1;
        
        let offset = new THREE.Vector3(0, 0, 0);
        
        if (activeAxis === "x") offset.x = pbLength * symbol;
        else if (activeAxis === "y") offset.y = pbLength * symbol;
        else offset.z = pbLength * symbol;
        
        if (rotate_value && rotate_value !== 0) {
            let radians = rotate_value * Math.PI / 180;
                        
            let rotationAxis = new THREE.Vector3(0, 0, 0);
            if (activeAxis_rotation === "x") rotationAxis.x = 1;
            else if (activeAxis_rotation === "y") rotationAxis.y = 1;
            else rotationAxis.z = 1;
            
            offset.applyAxisAngle(rotationAxis, radians);
        }

        let nextX = pbCX + offset.x;
        let nextY = pbCY + offset.y;
        let nextZ = pbCZ + offset.z;        
        
        return [nextX, nextY, nextZ];
        
}

// функция првоерки координат для конечного узла трубопровода
function check_End_Node(pbCX_end, pbCY_end, pbCZ_end){
    let foundNode = null;    
    Engine.scene.traverse((child) => {
        if (child.type === 'Node'|| child.type === 'Sprinkler') { 
            const child_World_Pos = new THREE.Vector3();
            child.getWorldPosition(child_World_Pos);                         
            if (child_World_Pos.x === pbCX_end && child_World_Pos.y === pbCY_end && child_World_Pos.z === pbCZ_end) {                            
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
    document.body.classList.add('builder-active');
    document.getElementById("number_pipe_edit").innerText = `${ Engine.selectedObject.name} id: ${Engine.selectedObject.id}`;
    document.getElementById("type_pipe_edit").innerText = Engine.selectedObject.ghost;
    document.getElementById("DN_pipe_edit").innerText = Engine.selectedObject.DN;
    document.getElementById("Length_pipe_edit").innerText = Engine.selectedObject.Length;
    
    // console.log("Engine.selectedObject",Engine.selectedObject);

    // document.getElementById("splitCancelBtn_Edit").addEventListener("click", () => cancel("PipelineModal_Edit"));
    // document.getElementById("splitApplyBtn_Edit").addEventListener("click", () => edit_pipe_tube(Engine.selectedObject));
    document.getElementById("splitCancelBtn_Edit").onclick = () => cancel("PipelineModal_Edit");
    document.getElementById("splitApplyBtn_Edit").onclick = () => edit_pipe_tube(Engine.selectedObject);
    
}
// функция дял изменения геометрии трубы
function edit_pipe_tube(Edge) {
    let start_node = Edge.start_node;
    let end_node = Edge.end_node;
    const new_type_tube = document.getElementById("get_tube_pipe_edit").selectedOptions[0].textContent; // тип трубы (ГОСТ)
        
    const new_pbDiameter = document.getElementById("pbDiameter_edit"); //// элемент для удосбвтва вывода свойств
    const new_DN_tube = parseFloat(new_pbDiameter.selectedOptions[0].textContent); ///// сами свойства
    const new_k_t = parseFloat(new_pbDiameter.selectedOptions[0].dataset.k_t);
    const new_kvelocity = parseFloat(new_pbDiameter.selectedOptions[0].dataset.kvelocity);
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
    Edge.geometry = new THREE.TubeGeometry(new_Path, 64, new_DN_tube / 2 / 1000, 12, false);
    
    Edge.ghost=new_type_tube;
    Edge.DN=new_DN_tube;
    Edge.k_t=new_k_t;
    Edge.kvelocity=new_kvelocity;
    Edge.Length = new_long;

    const new_Node_Geometry = new THREE.SphereGeometry(2*new_DN_tube/1000, 32, 32);
    Edge.start_node.geometry.dispose();
    Edge.end_node.geometry.dispose();
    Edge.start_node.geometry = new_Node_Geometry;
    Edge.end_node.geometry = new_Node_Geometry;
    cancel("PipelineModal_Edit");

    update_Node_XYZ();

    console.log("Engine.scene.children_EDIT",Engine.scene.children);
    // check_position_node_for_edge(Edge.end_node);
    check_position_node_for_edge();

}

// функция для обновления глобал координат (функция внутри класса Node)
function update_Node_XYZ(){
    Engine.scene.traverse((child) => {    
        if (child.name === 'Node_new') {
                        
            child.update_Global(); 
            
        }
    });
    console.log("Engine.scene.children_update_Node_XYZ",Engine.scene.children);
}

// функция првоерки и созданяи новой ветки 
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
        if (!Engine.selectedObject || (Engine.selectedObject.type !== 'Node' && Engine.selectedObject.type !== 'Sprinkler')) {
            alert("Выберите узел привязки!");
            return; 
        }
    }
    else{
        alert("Создайте и выберите узел!")
        return;
    }

    document.getElementById("createBranchModal").style.display = 'block';
    document.body.classList.add('builder-active');
    document.getElementById("createBranchCancelBtn").onclick = () => cancel("createBranchModal");

    const sprCountInput = document.getElementById("createBranchSprCount");
    sprCountInput.addEventListener("input", function() {
        let Count = parseFloat(document.getElementById("createBranchSprCount").value);        
        const tabContent = document.getElementById('myTabContent');                
        tabContent.innerHTML = html_branch_content(Count);        
        for (let i = 0; i < Count; i++) {
            get_load_pipe("get_tube_pipe_sprinkler", `pbDiameter_sprinkler_${i}`);            
            document.getElementById("get_tube_pipe_sprinkler").addEventListener("change", (event) => {
                get_load_pbDiameter(event.target.value, `pbDiameter_sprinkler_${i}`);   
            });
        }
    });
    sprCountInput.dispatchEvent(new Event('input'));   
    document.getElementById("createBranchApplyBtn").onclick = () => create_branch(Engine.selectedObject);
    // cancel("createBranchModal");
}


// // функция создания новой ветки
// function create_branch(Node) {    
//     const Count = parseFloat(document.getElementById("createBranchSprCount").value);
//     const activeAxis = document.querySelector('#createBranchModal .axis-btn.active').dataset.axis;

//     const type_tube = document.getElementById("get_tube_pipe_sprinkler").selectedOptions[0].textContent; // тип трубы (ГОСТ)        
//     const pbDiameter_sprinkler = document.getElementById("pbDiameter_sprinkler"); //// элемент для удосбвтва вывода свойств
//     const DN_tube = parseFloat(pbDiameter_sprinkler.selectedOptions[0].textContent); ///// сами свойства
//     const k_t = parseFloat(pbDiameter_sprinkler.selectedOptions[0].dataset.k_t);
//     const kvelocity = parseFloat(pbDiameter_sprinkler.selectedOptions[0].dataset.kvelocity);

//     console.table({            
//             "Гост на трубы": type_tube,
//             "Номинальный ДН трубы": DN_tube,
//             "Коэффициент k_t": k_t,
//             "Коэффициент kvelocity": kvelocity
//         });
//     // const Node_Start = Engine.selectedObject;
//     // создание контейнера для мировых координат
//     const start_World_Pos = new THREE.Vector3();
//     Node.getWorldPosition(start_World_Pos);
//     // Мировые координаты начального узла
//     let currentX = start_World_Pos.x;
//     let currentY = start_World_Pos.y;
//     let currentZ = start_World_Pos.z;
//     // Дефолтный материал
//     const Node_Geometry = new THREE.SphereGeometry(2 * 50 / 1000, 32, 32);
//     const Node_Material = new THREE.MeshBasicMaterial({ color: '#FF0000' });    
//     const Edge_Material = new THREE.MeshBasicMaterial({ color: '#0F1379' });    
    
    
//     let currentStartNode = Node;
//     // Цикл для создания ветвей и новых оросителей
//     for (let i = 0; i < Count; i++) {
        
//         const [pbCX_end, pbCY_end, pbCZ_end] = calculation_end_node(currentX, currentY, currentZ, 2, activeAxis);        
//         let currentEndNode;
//         // проверка на созданные орсоители пока не нужна 
//         // const check_node_end = check_End_Node(pbCX_end, pbCY_end, pbCZ_end);
//         // if (check_node_end) {
//         //     currentEndNode = check_node_end;
//         // } else {            
//         //     currentEndNode = new Node_new(Node_Geometry, Node_Material, 'Sprinkler');
//         //     currentEndNode.position.set(pbCX_end, pbCY_end, pbCZ_end);
//         // }
//         // Просто создаем новые узлы с типом орсоитель
//         currentEndNode = new Node_new(Node_Geometry, Node_Material, 'Sprinkler');
//         currentEndNode.position.set(pbCX_end, pbCY_end, pbCZ_end);

//         const step_Start_Pos = new THREE.Vector3();
//         currentStartNode.getWorldPosition(step_Start_Pos);

//         const step_End_Pos = new THREE.Vector3();
//         currentEndNode.getWorldPosition(step_End_Pos);
        
//         const path = new THREE.LineCurve3(step_Start_Pos, step_End_Pos);
//         const Pipe_visible = new THREE.TubeGeometry(path, 64, 50 / 2 / 1000, 12, false);
                
//         const Pipe_connection = new Edge_new(Pipe_visible, Edge_Material, currentStartNode, currentEndNode, 'Edge', 2, DN_tube, type_tube,
//             k_t, kvelocity);
        
//         currentStartNode.attach(Pipe_connection);
//         Pipe_connection.attach(currentEndNode);
                
//         currentStartNode = currentEndNode;
                
//         currentX = pbCX_end;
//         currentY = pbCY_end;
//         currentZ = pbCZ_end;
//     }
    
//     console.log("Engine.scene.children", Engine.scene.children);
//     cancel("createBranchModal");
//     update_Node_XYZ();

// }

function create_branch(Node) {    
    
    const activeAxis = document.querySelector('#createBranchModal .axis-btn.active').dataset.axis;
    const activeAxis_direction = document.querySelector('#createBranchModal .dir-btn.active').dataset.dir; // активное положение направления
    const activeAxis_rotation = document.querySelector('#createBranchModal .axis-btn-rot.active').dataset.axis; // активная ось дял порворота
    const rotate_value = parseFloat(document.getElementById("pbAngle_branch").value);   

    const type_tube = document.getElementById("get_tube_pipe_sprinkler").selectedOptions[0].textContent; // тип трубы (ГОСТ)
    const Count = parseFloat(document.getElementById("createBranchSprCount").value);
    
    const start_World_Pos = new THREE.Vector3();
    Node.getWorldPosition(start_World_Pos);
    
    let currentX = start_World_Pos.x;
    let currentY = start_World_Pos.y;
    let currentZ = start_World_Pos.z;
    // Дефолтный материал
    // const Node_Geometry = new THREE.SphereGeometry(2 * 50 / 1000, 32, 32);
    const Node_Material = new THREE.MeshBasicMaterial({ color: '#FF0000' });    
    const Edge_Material = new THREE.MeshBasicMaterial({ color: '#0F1379' });    

    let currentStartNode = Node;

    // Цикл для создания ветвей и новых оросителей
    for (let i = 0; i < Count; i++) {

        const pbDiameter_sprinkler = document.getElementById(`pbDiameter_sprinkler_${i}`); //// элемент для удосбвтва вывода свойств
        const new_DN_tube = parseFloat(pbDiameter_sprinkler.selectedOptions[0].textContent); ///// сами свойства
        const new_k_t = parseFloat(pbDiameter_sprinkler.selectedOptions[0].dataset.k_t);
        const new_kvelocity = parseFloat(pbDiameter_sprinkler.selectedOptions[0].dataset.kvelocity);
        // const new_long = parseFloat(document.getElementById("pipe_edit").value);   


        // const pbDiameter_sprinkler = parseFloat(document.getElementById(`pbDiameter_sprinkler_${i}`).value); //// элемент для удосбвтва вывода свойств
        const pbLength_branch = parseFloat(document.getElementById(`pbLength_branch_${i}`).value); //// элемент для удосбвтва вывода свойств
        
        const [pbCX_end, pbCY_end, pbCZ_end] = calculation_end_node(currentX, currentY, currentZ, pbLength_branch, activeAxis,
            activeAxis_direction, activeAxis_rotation, rotate_value);   
                
        let currentEndNode;
        console.log("new_DN_tube в создании ветки",new_DN_tube)
        const Node_Geometry = new THREE.SphereGeometry(2 * new_DN_tube / 1000, 32, 32);
        // проверка на созданные орсоители пока не нужна 
        const check_node_end = check_End_Node(pbCX_end, pbCY_end, pbCZ_end);
        if (check_node_end) {
            currentEndNode = check_node_end;
        } else {            
            currentEndNode = new Node_new(Node_Geometry, Node_Material, 'Sprinkler');
            currentEndNode.position.set(pbCX_end, pbCY_end, pbCZ_end);
        }
        // Просто создаем новые узлы с типом орсоитель
        // currentEndNode = new Node_new(Node_Geometry, Node_Material, 'Sprinkler');
        // currentEndNode.position.set(pbCX_end, pbCY_end, pbCZ_end);

        // ==========================================================
        // ДОБАВЛЕНИЕ СТРЕЛОЧКИ (ОРОСИТЕЛЯ), НАПРАВЛЕННОЙ ВНИЗ
        // ==========================================================
        const sprinklerGroup = new THREE.Group();
        sprinklerGroup.name = 'SprinklerArrow';
        const nodeRadius = 2 * new_DN_tube / 1000; // 0.1
        // 1. Стержень стрелки (цилиндр)
        const shaftRadius = nodeRadius * 0.1; // Пропорционально размеру узла
        const shaftHeight = nodeRadius * 2.5;
        const shaftGeo = new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftHeight, 16);
        const shaft = new THREE.Mesh(shaftGeo, Node_Material);
        // Сдвигаем вниз, чтобы начало было примерно от центра/низа сферы
        shaft.position.y = -(shaftHeight / 2); 
        
        // 2. Наконечник стрелки (конус, направленный вниз)
        const headRadius = nodeRadius * 1;
        const headHeight = nodeRadius * 1.5;
        const headGeo = new THREE.ConeGeometry(headRadius, headHeight, 16);
        const head = new THREE.Mesh(headGeo, Node_Material);
        head.rotation.x = Math.PI;
        head.position.y = -(shaftHeight + headHeight / 2);

        sprinklerGroup.add(shaft);
        sprinklerGroup.add(head);
        
        // Добавляем группу со стрелкой к узлу. 
        // Теперь стрелка будет двигаться и вращаться вместе с узлом.
        currentEndNode.add(sprinklerGroup);
        // ==========================================================

        const step_Start_Pos = new THREE.Vector3();
        currentStartNode.getWorldPosition(step_Start_Pos);

        const step_End_Pos = new THREE.Vector3();
        currentEndNode.getWorldPosition(step_End_Pos);
        
        const path = new THREE.LineCurve3(step_Start_Pos, step_End_Pos);
        const Pipe_visible = new THREE.TubeGeometry(path, 64, new_DN_tube / 2 / 1000, 12, false);
        
        // const Pipe_connection = new Edge_new(Piepe_visible, Edge_Material, Node_Start, Node_End, 'Edge', pbLength, pbDiameter,
        //      type_tube, k_t, kvelocity );
        const Pipe_connection = new Edge_new(Pipe_visible, Edge_Material, currentStartNode, currentEndNode, 'Edge',pbLength_branch,
            new_DN_tube, type_tube, new_k_t, new_kvelocity);
        
        currentStartNode.attach(Pipe_connection);
        Pipe_connection.attach(currentEndNode);
                
        currentStartNode = currentEndNode;
                
        currentX = pbCX_end;
        currentY = pbCY_end;
        currentZ = pbCZ_end;
    }
    
    console.log("Engine.scene.children", Engine.scene.children);
    updateTreeUI(); //Обновляем дерево построения
    cancel("createBranchModal");
    update_Node_XYZ();
}


function html_branch_content(Count) {
    let html = '';
    for (let i = 0; i < Count; i++) {
        html += `
            <div class="branch_segment" style="border-bottom: 1px solid #F3F2F8; margin-bottom: 15px; padding-bottom: 15px; ">
                <div class="step">
                    <span>Участок №${i + 1}</span>            
                </div>
                <div class="step">
                    <span>Диаметр трубопровода DN</span>
                    <select id="pbDiameter_sprinkler_${i}"></select>
                    <span>Длина, м</span>
                    <input type="number" id="pbLength_branch_${i}" value="5" step="0.1" min="0.1" max="100">
                </div>                
            </div>
        `;
    }
    return html;
}


function check_position_node_for_edge() {
    Engine.scene.traverse((child) => {
        if ( child.type === 'Edge') {
            const start_check = new THREE.Vector3();
            const end_check = new THREE.Vector3();
            child.start_node.getWorldPosition(start_check);
            child.end_node.getWorldPosition(end_check);
            const new_long = start_check.distanceTo(end_check); // пересчитанная длина ребра междлу точками
            child.Length = new_long;
            const Local_position_start = start_check.clone();
            const Local_position_end = end_check.clone();
            child.worldToLocal(Local_position_start); //переходим в координаты родителя
            child.worldToLocal(Local_position_end); //переходим в координаты родителя
            const path = new THREE.LineCurve3(Local_position_start, Local_position_end); // строим путь от родителя
            child.geometry.dispose(); // удаялем старую геомтерию
            child.geometry = new THREE.TubeGeometry(path, 64, child.DN / 2 / 1000, 12, false);
            child.updateMatrixWorld(true);
        }
    });    

}

// Удаление выбранной трубы и связанный с ней дочерних элементов и есть дочерний узел является концом другого трубопровода,тот тоже удаляется
function delete_pipe_tube() {
    // проверка существования трубопровода        
    let Check_tube = false;
    Engine.scene.traverse((child) => {       
        if (child.type === 'Edge') {
            Check_tube = true;
        }        
    });    
    if (Check_tube) {    
        if (!Engine.selectedObject || Engine.selectedObject.type !== 'Edge') {
            alert("Перед удалением выберите турбопровод!");
            return; 
        }
    }
    else{
        alert("Трубопроводов нет!")
        return;
    }
    
    if (Engine.selectedObject.parent) {
        Engine.selectedObject.parent.remove(Engine.selectedObject);
    } else {
        Engine.scene.remove(Engine.selectedObject);
    }
// у данного метода возможен скрытый баг, при обходе всех объектов на сцене и динамичном их удалении , возможно переназначение
// внутреннего id объектов и слцучайных пропуск элемента , идущег осразу за удаленным!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// 2 цикла в каждом удалении обусловлены логикой работы js, он переназанчает id объектов динамичнро
    Engine.selectedObject.traverse((child_node) => {
        if (child_node.name === 'Node_new') {
            const child_tube = [];
            Engine.scene.traverse((scene_Child) => {
                // Ищем трубы, которые НЕ принадлежат удаляемому объекту
                if (scene_Child.type ==='Edge' && scene_Child.parent.uuid !== Engine.selectedObject.uuid) {
                    child_tube.push(scene_Child);
                }
            });
            child_tube.forEach((child) => {                
                if (child.start_node.uuid === child_node.uuid || child.end_node.uuid === child_node.uuid) {
                    child.parent.remove(child);
                }                
            });            
        }        
    });

    Engine.scene.updateMatrixWorld(true);
    // массив и логика проверки источника (source) если он являестя родителем и не имеет больше дочерних
    // элементов то тоже удаляется со сцены
    const source_node = [];
    Engine.scene.traverse((child_node)=>{        
        if (child_node.type === "Source" && child_node.children.length === 0) {
            source_node.push(child_node);            
        }        
    });
    source_node.forEach((child) => {                
            if (child.parent) {
                child.parent.remove(child);
            } else {
                Engine.scene.remove(child);
            }              
        });
    Engine.scene.updateMatrixWorld(true);
    updateTreeUI();
    console.log("Engine.scene.children проверка после удаления",Engine.scene.children);
    
}







// async function sendJson(v) {
//         console.log("vvvvvvvvvvvvvvvvv",v)
//         // const v = document.getElementById('graphJsonOutput').value;
//     try {
//             const response = await fetch('api/sole/', {
//             method: 'POST', // Метод запроса
//             headers: {
//                 'Content-Type': 'application/json;charset=utf-8' // Указываем тип данных
//         },
//         body: JSON.stringify(v)
//         });
//                 if (!response.ok) {
//                 throw new Error(`Ошибка HTTP: ${response.status}`);
//                 }
//                 const result = await response.json(); // Читаем ответ сервера в формате JSON
//                 console.log('Ответ от сервера:', result);
//             } catch (error) {
//                 console.error('Ошибка при отправке запроса:', error);
//             }
// };


// async function sendJsonAndVisualize(v) {
//     console.log("📤 Отправка данных на расчет...", v);
    
//     try {
//         const response = await fetch('api/sole/', {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json;charset=utf-8'
//             },
//             body: JSON.stringify(v)
//         });

//         if (!response.ok) {
//             const errorData = await response.json().catch(() => ({}));
//             throw new Error(errorData.message || `Ошибка HTTP: ${response.status}`);
//         }

//         const result = await response.json();
//         console.log('✅ Ответ от сервера:', result);

//         if (result.status === "success") {
//             // Вызываем функцию отрисовки меток на сцене
//             visualizeResults(result);
//         } else {
//             alert("Ошибка расчета: " + result.message);
//         }

//     } catch (error) {
//         console.error('❌ Ошибка при отправке запроса:', error);
//         alert("Ошибка сети или сервера: " + error.message);
//     }
// }




async function sendJsonAndVisualize(v) {
    console.log(" Отправка данных на расчет...", v);
    
    try {
        const response = await fetch('api/sole/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json;charset=utf-8'
            },
            body: JSON.stringify(v)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Ошибка HTTP: ${response.status}`);
        }

        const result = await response.json();
        console.log('✅ Ответ от сервера:', result);

        if (result.status === "success") {
            // ✅ ДОБАВИТЬ ЭТО: сохраняем данные для графика
            window.lastCalculationResult = {
                K_system: result.summary.K_system || 0.025,
                Z_max: result.summary.Z_max || 0.0,
                Q_total: result.summary.source_flow_l_s || 0.0,
                H_source: result.summary.source_pressure_m || 0.0
            };
            
            console.log("💾 Данные для графика сохранены:", window.lastCalculationResult);

            // Вызываем функцию отрисовки меток на сцене
            visualizeResults(result);
        } else {
            alert("Ошибка расчета: " + result.message);
        }

    } catch (error) {
        console.error('❌ Ошибка при отправке запроса:', error);
        alert("Ошибка сети или сервера: " + error.message);
    }
}

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

// ============================================================================
// 1. Вспомогательная функция для создания текстовых меток (Sprite)
// ============================================================================
function createTextLabel(text, color = '#ffffff', yOffset = 0.5) {
    // Делаем канвас КВАДРАТНЫМ для правильных пропорций
    const canvas = document.createElement('canvas');
    const size = 512;
    canvas.width = size;
    canvas.height = size;
    
    const ctx = canvas.getContext('2d');
    ctx.font = 'Bold 36px Arial, sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const lines = text.split('\n');
    const lineHeight = 60;
    const startY = (size - (lines.length * lineHeight)) / 2 + lineHeight / 2;

    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    lines.forEach((line, i) => {
        ctx.fillText(line, size / 2, startY + i * lineHeight);
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    
    const material = new THREE.SpriteMaterial({ 
        map: texture, 
        depthTest: false,
        transparent: true,
        sizeAttenuation: true  // Важно: масштаб зависит от расстояния до камеры
    });
    
    const sprite = new THREE.Sprite(material);
    // КВАДРАТНЫЙ масштаб — текст не будет сплюснут
    sprite.scale.set(2, 2, 1);
    sprite.position.y = yOffset;
    sprite.name = 'CalculationLabel';
    
    return sprite;
}


// ============================================================================
// ТЕКСТОВАЯ МЕТКА, ПОВЁРНУТАЯ ВДОЛЬ ТРУБЫ
// ============================================================================
function createTextLabelAlongPipe(text, startWorld, endWorld, color = '#ffffff', offset = 0.15) {
    // 1. Создаём canvas с текстом
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const fontSize = 32;
    ctx.font = `Bold ${fontSize}px Arial, sans-serif`;
    const textWidth = ctx.measureText(text).width;
    
    // Размеры canvas с запасом
    const padding = 20;
    canvas.width = Math.ceil(textWidth + padding * 2);
    canvas.height = fontSize + padding * 2;
    
    // Рисуем текст
    ctx.font = `Bold ${fontSize}px Arial, sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    
    // 2. Создаём плоскость с пропорциями текста
    // Масштаб: 1 пиксель = 0.005 метра (настройте под себя)
    const scale = 0.005;
    const planeWidth = canvas.width * scale;
    const planeHeight = canvas.height * scale;
    
    const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        depthTest: false
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    
    // 3. Вычисляем направление трубы
    const direction = new THREE.Vector3()
        .subVectors(endWorld, startWorld)
        .normalize();
    
    // 4. Середина трубы
    const midPoint = new THREE.Vector3()
        .lerpVectors(startWorld, endWorld, 0.5);
    
    // 5. Поворот плоскости вдоль трубы
    // PlaneGeometry по умолчанию лежит в плоскости XY (нормаль = Z)
    // Разворачиваем так, чтобы нормаль смотрела вдоль трубы
    const quaternion = new THREE.Quaternion()
        .setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
    mesh.quaternion.copy(quaternion);
    
    // 6. Проверяем, не перевёрнут ли текст
    // Если труба идёт "вниз" (Y < 0), текст окажется вверх ногами
    // Разворачиваем на 180° вокруг оси трубы
    if (direction.y < 0) {
        const flipQuaternion = new THREE.Quaternion()
            .setFromAxisAngle(direction, Math.PI);
        mesh.quaternion.premultiply(flipQuaternion);
    }
    
    // 7. Смещение перпендикулярно трубе
    const upVector = new THREE.Vector3(0, 1, 0);
    if (Math.abs(direction.dot(upVector)) > 0.9) {
        upVector.set(0, 0, 1);
    }
    const offsetDir = new THREE.Vector3()
        .crossVectors(direction, upVector)
        .normalize();
    
    if (offsetDir.length() < 0.01) {
        offsetDir.set(1, 0, 0);
    }
    
    mesh.position.copy(midPoint);
    mesh.position.add(offsetDir.multiplyScalar(offset));
    
    mesh.name = 'PipeLabel';
    
    return mesh;
}



// ============================================================================
// 2. Функция очистки старых меток (ВАЖНО для предотвращения утечек памяти!)
// ============================================================================
function clearCalculationLabels() {
    const labelsToRemove = [];
    
    Engine.scene.traverse((child) => {
        // Очищаем и текстовые метки, и стрелки направления
        if (child && (child.name === 'CalculationLabel' || child.name === 'FlowArrow')) {
            labelsToRemove.push(child);
        }
    });
    
    labelsToRemove.forEach(label => {
        try {
            if (label.parent) {
                label.parent.remove(label);
            }
            if (label.material) {
                if (label.material.map) label.material.map.dispose();
                label.material.dispose();
            }
            // Для ArrowHelper нужно удалить и линию, и конус
            if (label.line && label.line.material) {
                label.line.material.dispose();
            }
            if (label.cone && label.cone.material) {
                label.cone.material.dispose();
            }
        } catch (e) {
            console.warn('Ошибка при удалении метки/стрелки:', e);
        }
    });
    
    console.log(`🗑️ Удалено объектов визуализации: ${labelsToRemove.length}`);
}

function cleanSceneOrphans() {
    // Удаляем undefined детей из всех объектов сцены
    Engine.scene.traverse((parent) => {
        if (parent.children) {
            parent.children = parent.children.filter(child => child !== undefined && child !== null);
        }
    });
    
    // Очищаем STATE.Three_D_objects от битых ссылок
    STATE.Three_D_objects = STATE.Three_D_objects.filter(obj => {
        if (!obj || !obj.uuid) return false;
        // Проверяем, что объект всё ещё в сцене
        let found = false;
        Engine.scene.traverse((child) => {
            if (child.uuid === obj.uuid) found = true;
        });
        return found;
    });
    
    console.log(`🧹 Очистка сцены: ${STATE.Three_D_objects.length} объектов осталось`);
}


// ============================================================================
// 3. Главная функция визуализации результатов
// ============================================================================
// function visualizeResults(result) {
//     console.log('🚀 Начинаем визуализацию...');
    
//     // Очищаем битые ссылки перед работой
//     cleanSceneOrphans();
    
//     // Очищаем старые метки
//     clearCalculationLabels();

//     let nodesCount = 0;
//     let edgesCount = 0;

//     // 2. Добавляем метки к УЗЛАМ (Node / Source / Sprinkler)
//     for (const [uuid, data] of Object.entries(result.nodes)) {
//         // Ищем объект в сцене по UUID (приводим оба к нижнему регистру!)
//         const nodeObj = STATE.Three_D_objects.find(
//             obj => obj.uuid.toLowerCase() === uuid.toLowerCase() && 
//                    (obj.type === 'Node' || obj.type === 'Source' || obj.type === 'Sprinkler')
//         );

//         if (nodeObj) {
//             let labelText = `P = ${data.pressure_m.toFixed(4)} м`;
//             let labelColor = '#080808'; // 

//             if (data.type === 'sprinkler') {
//                 labelText += `\nQ = ${data.sprinkler_flow_l_s.toFixed(4)} л/с`;
//                 // Подсветка красным, если давление ниже требуемого (10 м)
//                 if (data.pressure_m < 10) {
//                     labelColor = '#ff3333'; 
//                 }
//             } else if (data.type === 'source') {
//                 labelText += `\nQ= ${result.summary.total_flow_l_s.toFixed(4)} л/с`;
//                 labelColor = '#080808'; // 
//             }

//             const label = createTextLabel(labelText, labelColor, 0.5);
//             nodeObj.add(label); // Добавляем как дочерний элемент узла
//             nodesCount++;
//         }
//     }

//     // 3. Добавляем метки и СТРЕЛКИ НАПРАВЛЕНИЯ к ТРУБАМ (Edge)
//     for (const [uuid, data] of Object.entries(result.edges)) {
//         const edgeObj = STATE.Three_D_objects.find(
//             obj => obj.uuid.toLowerCase() === uuid.toLowerCase() && obj.type === 'Edge'
//         );

//         if (edgeObj && edgeObj.start_node && edgeObj.end_node) {
//             // Мировые координаты начала и конца трубы
//             const startWorld = new THREE.Vector3();
//             const endWorld = new THREE.Vector3();
//             edgeObj.start_node.getWorldPosition(startWorld);
//             edgeObj.end_node.getWorldPosition(endWorld);

//             // Середина трубы для текстовой метки
//             const midWorld = new THREE.Vector3().lerpVectors(startWorld, endWorld, 0.5);

//             // Текстовая метка расхода
//             const flowValue = Math.abs(data.flow_l_s);
//             const labelText = `Q= ${flowValue.toFixed(4)} л/с`;
//             const label = createTextLabel(labelText, '#080808', 0);
//             label.position.copy(midWorld);
//             label.position.y += 0.2;
//             Engine.scene.add(label);

//             // ============================================================
//             // СТРЕЛКА НАПРАВЛЕНИЯ ТЕЧЕНИЯ
//             // ============================================================
//             // По умолчанию forward — от start к end
//             // Если reverse — меняем направление
//             const isReverse = (data.direction === 'reverse');
            
//             // Цвет стрелки: голубой для forward, оранжевый для reverse
//             const arrowColor = isReverse ? '#00ff37' : '#00ff37';
            
//             const flowArrow = createFlowArrow(
//                 startWorld, 
//                 endWorld, 
//                 isReverse, 
//                 arrowColor
//             );
//             Engine.scene.add(flowArrow);

//             // Логируем для отладки
//             if (isReverse) {
//                 console.log(`⚠️ Труба ${uuid}: ОБРАТНОЕ направление течения!`);
//             }

//             edgesCount++;
//         }
//     }

//     console.log(`✅ ВИЗУАЛИЗАЦИЯ ЗАВЕРШЕНА! Добавлено меток: узлов=${nodesCount}, труб=${edgesCount}`);
//     alert(`✅ Расчет успешно завершен!\nДавление насоса: ${result.summary.source_pressure_m.toFixed(2)} м\nДобавлено меток: ${nodesCount + edgesCount}`);
// }


// ============================================================================
// 3. Главная функция визуализации результатов
// ============================================================================
function visualizeResults(result) {
    console.log('🚀 Начинаем визуализацию...');
    
    // Очищаем битые ссылки перед работой
    cleanSceneOrphans();
    
    // Очищаем старые метки
    clearCalculationLabels();

    let nodesCount = 0;
    let edgesCount = 0;

    // 2. Добавляем метки к УЗЛАМ (Node / Source / Sprinkler)
    for (const [uuid, data] of Object.entries(result.nodes)) {
        const nodeObj = STATE.Three_D_objects.find(
            obj => obj.uuid.toLowerCase() === uuid.toLowerCase() && 
                   (obj.type === 'Node' || obj.type === 'Source' || obj.type === 'Sprinkler')
        );

        if (nodeObj) {
            // Получаем мировые координаты узла
            const nodeWorldPos = new THREE.Vector3();
            nodeObj.getWorldPosition(nodeWorldPos);
            
            // Давление — ОТДЕЛЬНОЙ меткой СВЕРХУ узла
            const pressureLabel = `${data.pressure_m.toFixed(2)} м вод. ст.`;
            const pressureLabelMesh = createTextLabel(pressureLabel, '#000000', 0);
            pressureLabelMesh.position.copy(nodeWorldPos);
            pressureLabelMesh.position.y += 0.25;  // ⬆️ Поднимаем выше (было 0.25)
            Engine.scene.add(pressureLabelMesh);
            
            // Для оросителей добавляем расход
            if (data.type === 'sprinkler') {
                const flowLabel = `${data.sprinkler_flow_l_s.toFixed(2)} л/с`;
                const flowLabelMesh = createTextLabel(flowLabel, '#000000', 0);
                flowLabelMesh.position.copy(nodeWorldPos);
                flowLabelMesh.position.y -= 0.6;  // Чуть ниже давления
                Engine.scene.add(flowLabelMesh);
                
                if (data.pressure_m < 10) {
                    pressureLabelMesh.material.color.set('#000000');
                }
            } 
            // Для источников
            else if (data.type === 'source') {
                const sourceFlowLabel = `${Math.abs(result.summary.total_flow_l_s).toFixed(2)} л/с`;
                const sourceFlowLabelMesh = createTextLabel(sourceFlowLabel, '#000000', 0);
                sourceFlowLabelMesh.position.copy(nodeWorldPos);
                sourceFlowLabelMesh.position.y += 0.4;  // Чуть ниже давления
                Engine.scene.add(sourceFlowLabelMesh);
            }
            
            nodesCount++;
        }
    }

    // 3. Добавляем метки РАСХОДА и СТРЕЛКИ НАПРАВЛЕНИЯ к ТРУБАМ (Edge)
    for (const [uuid, data] of Object.entries(result.edges)) {
        const edgeObj = STATE.Three_D_objects.find(
            obj => obj.uuid.toLowerCase() === uuid.toLowerCase() && obj.type === 'Edge'
        );

        if (edgeObj && edgeObj.start_node && edgeObj.end_node) {
            // Мировые координаты начала и конца трубы
            const startWorld = new THREE.Vector3();
            const endWorld = new THREE.Vector3();
            edgeObj.start_node.getWorldPosition(startWorld);
            edgeObj.end_node.getWorldPosition(endWorld);

            // Середина трубы
            const midWorld = new THREE.Vector3().lerpVectors(startWorld, endWorld, 0.5);

            // Текстовая метка расхода — рядом со стрелкой (чуть ниже трубы)
            const flowValue = Math.abs(data.flow_l_s);
            const labelText = `${flowValue.toFixed(3)} л/с`;
            const label = createTextLabel(labelText, '#000000', 0);
            label.position.copy(midWorld);
            label.position.y -= 0.25;  // ️ Опускаем ниже трубы (рядом со стрелкой)
            Engine.scene.add(label);

            // ============================================================
            // СТРЕЛКА НАПРАВЛЕНИЯ ТЕЧЕНИЯ
            // ============================================================
            const isReverse = (data.direction === 'reverse');
            // const arrowColor = '#0f1379';
            const arrowColor = '#006400';
            
            const flowArrow = createFlowArrow(
                startWorld, 
                endWorld, 
                isReverse, 
                arrowColor
            );
            Engine.scene.add(flowArrow);

            if (isReverse) {
                console.log(`⚠️ Труба ${uuid}: ОБРАТНОЕ направление течения`);
            }

            edgesCount++;
        }
    }

    console.log(`✅ ВИЗУАЛИЗАЦИЯ ЗАВЕРШЕНА! Добавлено меток: узлов=${nodesCount}, труб=${edgesCount}`);

    alert(
    `✅ Расчет успешно завершен!\n` +
    `Давление насоса: ${result.summary.source_pressure_m.toFixed(2)} м\n` +
    `Добавлено меток: ${nodesCount + edgesCount}\n\n` +
    `⏱️ Время расчета (всего): ${result.summary.timing.total_s.toFixed(4)} сек\n` +
    `  • Этап 1: ${result.summary.timing.stage1_s.toFixed(4)} сек\n` +
    `  • Поиск источника: ${result.summary.timing.source_search_s.toFixed(4)} сек\n` +
    `  • Финальное решение: ${result.summary.timing.final_solve_s.toFixed(4)} сек\n\n` +
    `📊 Невязки:\n` +
    `  • Норма невязки: ${result.summary.residual_norm.toExponential(4)}\n` +
    `  • Макс. невязка: ${result.summary.max_residual.toExponential(4)}`
);

}

// Функция для проверки структуры STATE.Three_D_objects
function checkSceneStructure() {
    console.log('=== ПРОВЕРКА СЦЕНЫ ===');
    console.log('Всего объектов в STATE.Three_D_objects:', STATE.Three_D_objects.length);
    
    const nodes = STATE.Three_D_objects.filter(obj => 
        obj.type === 'Node' || obj.type === 'Source' || obj.type === 'Sprinkler'
    );
    const edges = STATE.Three_D_objects.filter(obj => obj.type === 'Edge');
    
    console.log('Узлов:', nodes.length);
    console.log('Труб:', edges.length);
    
    if (nodes.length > 0) {
        console.log('Пример UUID первого узла:', nodes[0].uuid);
        console.log('Тип первого узла:', nodes[0].type);
    }
    if (edges.length > 0) {
        console.log('Пример UUID первой трубы:', edges[0].uuid);
    }
}

// ============================================================================
// 4. Функция создания стрелки направления течения (КОНУС ПО ОСИ ТРУБЫ)
// ============================================================================
function createFlowArrow(startWorld, endWorld, isReverse = false, color = '#006400') {
    // 1. Определяем направление потока
    const from = isReverse ? endWorld.clone() : startWorld.clone();
    const to = isReverse ? startWorld.clone() : endWorld.clone();
    
    const direction = new THREE.Vector3().subVectors(to, from).normalize();
    
    // 2. Точный центр трубы
    const midPoint = new THREE.Vector3().lerpVectors(startWorld, endWorld, 0.5);

    // 3. Размеры конуса (уменьшенные для лучшего вида)
    const pipeLength = startWorld.distanceTo(endWorld);
    const coneHeight = Math.min(pipeLength * 0.15, 0.8); // Высота конуса (25% длины трубы, макс 0.8м)
    const coneRadius = coneHeight * 0.5;                 // Радиус основания (половина высоты)

    // 4. Создаём геометрию конуса (32 сегмента для гладкости)
    const geometry = new THREE.ConeGeometry(coneRadius, coneHeight, 128);
    
    // 5. Материал
    const material = new THREE.MeshBasicMaterial({ 
        color: color
        // transparent: true,
        // opacity: 0.85
    });

    // 6. Создаём меш
    const cone = new THREE.Mesh(geometry, material);

    // 7. Позиционируем в центре трубы
    cone.position.copy(midPoint);

    // 8. ПОВОРОТ КОНУСА ПО НАПРАВЛЕНИЮ ТРУБЫ
    // ConeGeometry по умолчанию смотрит вверх (0, 1, 0)
    // Поворачиваем так, чтобы ось Y конуса совпала с direction
    const yAxis = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(yAxis, direction);
    cone.setRotationFromQuaternion(quaternion);

    // 9. Небольшое смещение перпендикулярно трубе, чтобы конус не сливался с ней
    // Находим вектор, перпендикулярный направлению
    const upVector = new THREE.Vector3(0, 1, 0);
    if (Math.abs(direction.dot(upVector)) > 0.9) {
        upVector.set(0, 0, 1); // Если труба вертикальна, используем Z
    }
    const offsetDir = new THREE.Vector3().crossVectors(direction, upVector).normalize();
    
    // Если cross product дал ноль (труба строго по Z), берем X
    if (offsetDir.length() < 0.01) {
        offsetDir.set(1, 0, 0);
    }
    
    // Сдвигаем конус на 0.12 м перпендикулярно трубе
    cone.position.add(offsetDir.multiplyScalar(0));

    cone.name = 'FlowArrow';

    return cone;
}

// ============================================================================
// ЭКСПОРТ ДАННЫХ СЕТИ В JSON
// ============================================================================
function exportToJSON() {
    // Собираем данные из сцены
    const Data_base = {
        Node: [],
        Edge: [],
        PRESSURE_TARGET: 19.17  // Целевое давление по умолчанию
    };
    
    Engine.scene.traverse((child) => {    
        if (typeof child.add_list === 'function') {
            if (child.type === 'Edge' || child.isEdgeGroup) {
                // Для групп берем толстую трубу
                const edge = child.isEdgeGroup ? 
                    child.children.find(m => m.name === 'thickPipe') : child;
                
                if (edge && typeof edge.add_list === 'function') {
                    Data_base.Edge.push(edge.add_list());
                }
            }
            else {
                const properties = child.add_list();
                Data_base.Node.push(properties);
            }
        }       
    });
    
    console.log("📦 Данные для экспорта:", Data_base);
    
    // Создаем JSON-строку с форматированием
    const jsonString = JSON.stringify(Data_base, null, 2);
    
    // Создаем Blob и ссылку для скачивания
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Создаем временную ссылку
    const link = document.createElement('a');
    link.href = url;
    link.download = `network_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    
    // Имитируем клик
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Освобождаем URL
    URL.revokeObjectURL(url);
    
    console.log("✅ JSON-файл успешно экспортирован");
    
    // Показываем уведомление
    if (typeof Utils !== 'undefined' && Utils.showStatus) {
        Utils.showStatus('JSON-файл экспортирован');
    }
}





// ============================================================================
// УПРАВЛЕНИЕ ДЕРЕВОМ ПОСТРОЕНИЯ
// ============================================================================
// ============================================================================
// УПРАВЛЕНИЕ ДЕРЕВОМ ПОСТРОЕНИЯ
// ============================================================================
let treeVisible = false;
let treeBuilt = false;

function toggleTree() {
  const panel = document.getElementById('treePanel');
  const btn = document.getElementById('floatingTreeBtn');
  const title = document.getElementById('treeTitle');
  
  if (!treeBuilt) return;
  
  treeVisible = !treeVisible;
  
  if (treeVisible) {
    panel.classList.remove('hidden');
    btn.classList.add('active');
    title.classList.add('visible');  // ← Показываем заголовок
  } else {
    panel.classList.add('hidden');
    btn.classList.remove('active');
    title.classList.remove('visible');  // ← Скрываем заголовок
  }
}

function updateTreeUI() {
  const btn = document.getElementById('floatingTreeBtn');
  if (btn) {
    btn.classList.add('active');
  }
  treeBuilt = true;
  buildTree(true);  // true = свернуть все группы
}

function buildTree(collapseAll = false) {
  const container = document.getElementById('treeContainer');
  if (!container || !Engine || !Engine.scene) return;
  
  container.innerHTML = '';
  const rootUl = document.createElement('ul');
  rootUl.className = 'tree-root';

  let sources = [], nodes = [], sprinklers = [], edges = [];

  Engine.scene.traverse((child) => {
    if (['FlowArrow', 'CalculationLabel', 'PipeLabel', 'NodeLabel', 
         'SprinklerArrow', 'GridHelper', 'AxesHelper', 'thickPipe', 'thinPipe'].includes(child.name)) {
      return;
    }

    if (child.isEdgeGroup) {
      const thickPipe = child.children.find(m => m.name === 'thickPipe');
      if (thickPipe) {
        const dn = thickPipe.DN || thickPipe.diameter || 50;
        const len = thickPipe.Length ? thickPipe.Length.toFixed(1) : '?';
        edges.push({ 
          id: child.uuid, 
          name: `Труба (DN${dn}, ${len}м)`, 
          type: 'Edge', 
          object: child 
        });
      }
      return;
    }

    let type = (child.type || '').trim();
    let name = (child.name || '').trim();
    
    const cleanType = type.toLowerCase();
    const cleanName = name.toLowerCase();

    if (cleanType === 'source' || cleanName === 'source' || cleanName.includes('source')) {
      sources.push({ id: child.uuid, name: 'Источник', type: 'Source', object: child });
    }
    else if (cleanType === 'sprinkler' || cleanName === 'sprinkler' || cleanName.includes('sprinkler')) {
      sprinklers.push({ id: child.uuid, name: 'Ороситель', type: 'Sprinkler', object: child });
    }
    else if (cleanType === 'node' || cleanName === 'node' || cleanName.includes('node_new')) {
      nodes.push({ id: child.uuid, name: 'Узел', type: 'Node', object: child });
    }
    else if (cleanType === 'edge' || cleanType === 'edge_new' || cleanName.includes('edge')) {
      const dn = child.DN || child.diameter || 50;
      const len = child.Length ? child.Length.toFixed(1) : '?';
      edges.push({ 
        id: child.uuid, 
        name: `Труба (DN${dn}, ${len}м)`, 
        type: 'Edge', 
        object: child 
      });
    }
  });

  const createGroup = (title, type, items) => {
    if (items.length === 0) return null;
    
    const groupLi = document.createElement('li');
    groupLi.className = 'tree-group';

    const header = document.createElement('div');
    header.className = 'tree-group-header';
    
    const toggleClass = collapseAll ? 'tree-toggle collapsed' : 'tree-toggle expanded';
    const listClass = collapseAll ? 'tree-list hidden' : 'tree-list';
    
    header.innerHTML = `
      <span class="${toggleClass}"></span>
      <span class="tree-group-icon ${type.toLowerCase()}"></span>
      <span class="tree-group-name">${title} [${items.length}]</span>
    `;

    const childUl = document.createElement('ul');
    childUl.className = listClass;

    items.forEach((item, index) => {
      const itemLi = document.createElement('li');
      itemLi.className = 'tree-item';
      
      const displayName = items.length > 1 ? `${item.name} ${index + 1}` : item.name;
      
      itemLi.innerHTML = `
        <span class="tree-item-icon ${type.toLowerCase()}"></span>
        <span class="tree-item-name" title="${displayName}">${displayName}</span>
      `;
      
      itemLi.addEventListener('click', (e) => {
        e.stopPropagation();
        container.querySelectorAll('.tree-item.selected').forEach(el => 
          el.classList.remove('selected'));
        itemLi.classList.add('selected');
        
        if (Engine) Engine.selectedObject = item.object;
        focusOnItem(item.object);
      });
      
      childUl.appendChild(itemLi);
    });

    header.addEventListener('click', () => {
      const toggle = header.querySelector('.tree-toggle');
      toggle.classList.toggle('expanded');
      toggle.classList.toggle('collapsed');
      childUl.classList.toggle('hidden');
    });

    groupLi.appendChild(header);
    groupLi.appendChild(childUl);
    return groupLi;
  };

  [createGroup('Источники', 'Source', sources),
   createGroup('Узлы', 'Node', nodes),
   createGroup('Оросители', 'Sprinkler', sprinklers),
   createGroup('Трубопроводы', 'Edge', edges)
  ].forEach(g => { if (g) rootUl.appendChild(g); });

  container.appendChild(rootUl);
}

function focusOnItem(object) {
  if (!Engine || !Engine.camera || !Engine.controls) return;
  const pos = new THREE.Vector3();
  if (object.getWorldPosition) object.getWorldPosition(pos);
  else pos.copy(object.position);
  
  Engine.camera.position.set(pos.x + 5, pos.y + 5, pos.z + 5);
  Engine.controls.target.copy(pos);
  Engine.controls.update();
}

// Привязка кнопки
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("floatingTreeBtn");
  if (btn) {
    btn.onclick = () => toggleTree();
  }
});


// ============================================================================
// ПРИНУДИТЕЛЬНОЕ ИСПРАВЛЕНИЕ ВИДИМОСТИ СЦЕНЫ (Гарантия отображения)
// ============================================================================
window.addEventListener('load', () => {
    setTimeout(() => {
        // 1. Гарантированно скрываем экран загрузки, если он "завис"
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.classList.add('hidden');
        }

        // 2. Проверяем, инициализирован ли Engine
        if (typeof Engine !== 'undefined' && Engine.scene) {
            // Принудительно задаем светлый фон сцены (убирает черноту)
            Engine.scene.background = new THREE.Color(0xf5f5f5);
            
            // 3. Проверяем наличие сетки и осей, добавляем их, если нет
            let hasGrid = false;
            let hasAxes = false;
            
            Engine.scene.traverse((child) => {
                if (child.type === 'GridHelper') hasGrid = true;
                if (child.type === 'AxesHelper') hasAxes = true;
            });

            if (!hasGrid) {
                const gridHelper = new THREE.GridHelper(50, 50, 0xcccccc, 0xe0e0e0);
                Engine.scene.add(gridHelper);
                console.log("✅ Сетка добавлена принудительно");
            }
            
            if (!hasAxes) {
                const axesHelper = new THREE.AxesHelper(2);
                Engine.scene.add(axesHelper);
                console.log("✅ Оси координат добавлены принудительно");
            }

            // 4. Принудительно обновляем размеры рендера и камеры (на случай сбоев ресайза)
            if (Engine.renderer && Engine.camera) {
                Engine.renderer.setSize(window.innerWidth, window.innerHeight);
                Engine.camera.aspect = window.innerWidth / window.innerHeight;
                Engine.camera.updateProjectionMatrix();
                console.log("✅ Размеры канваса обновлены");
            }
        } else {
            console.warn("⚠️ Объект Engine или Engine.scene не найден при загрузке!");
        }
    }, 500); // Задержка 500мс дает время на полную инициализацию Engine из других файлов
});