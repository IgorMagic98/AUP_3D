// слушатель для обработки ячейки ввода длины при создании трубопровода
document.getElementById("pbLength").addEventListener("blur", (event) => {
    let value = parseFloat(event.target.value);
        
    if (isNaN(value) || value < 0.1) {
        event.target.value = "0.1"; 
    } 
    // else if (value > 100) {
    //     event.target.value = "100"; 
    // }
});
// слушатель для обработки ячейки ввода длины при создании трубопровода
document.getElementById("pipe_edit").addEventListener("blur", (event) => {
    let value = parseFloat(event.target.value);
        
    if (isNaN(value) || value < 0.1) {
        event.target.value = "0.1"; 
    } 
    // else if (value > 100) {
    //     event.target.value = "100"; 
    // }
});

// Функция заполнения типа трубы 
async function get_load_pipe(type_tube, dn_tube) {    
    let selectPipeTube = document.getElementById(type_tube);
    // console.log("name_cell",name_cell)
    const tubeTypes = await getTubeTypes();    
    // console.log("tubeTypes массив данных", tubeTypes);
    selectPipeTube.innerHTML = "";
    tubeTypes.forEach((tube) => {
        const option = document.createElement("option");
        option.value = tube.id;
        option.textContent = tube.name;
        selectPipeTube.appendChild(option);
    });
    get_load_pbDiameter(selectPipeTube.value, dn_tube);    
}
get_load_pipe("get_tube_pipe", "pbDiameter");
get_load_pipe("get_tube_pipe_sprinkler", "pbDiameter_sprinkler_0");
// get_load_pipe("get_tube_pipe_edit", "pbDiameter_edit");
// функция заполнения ДУ для типа труб и сохранени ег освйоств
async function get_load_pbDiameter(TubeTypeValue, dn_tube) {
    const tube_DN = await getTube(TubeTypeValue);
    console.log("tube_DN массив данных",tube_DN);
    let pdDN = document.getElementById(dn_tube);
    if (!pdDN) return;
    pdDN.innerHTML = "";
    tube_DN.forEach((tube) => {
        const option = document.createElement("option");
        option.value = tube.id;
        option.textContent = tube.nom_size;
        option.dataset.k_t = tube.k_t;
        option.dataset.kvelocity = tube.kvelocity;
        pdDN.appendChild(option);
    });   
    
    // pdDN.value = "6";    
    pdDN.dispatchEvent(new Event("change")); 
}
// // Cлушатель для выбранного ДУ , вывод свойств
// document.getElementById("pbDiameter").addEventListener("change", (event) => {
//     const selectedOption = event.target.selectedOptions[0];
//     const id = selectedOption.value;
//     const nomSize = selectedOption.textContent;    
// });
// // Cлушатель для выбранного ДУ , вывод свойств
// // document.getElementById("pbDiameter_sprinkler").addEventListener("change", (event) => {
// //     const selectedOption = event.target.selectedOptions[0];
// //     const id = selectedOption.value;
// //     const nomSize = selectedOption.textContent;    
// // });
// // Cлушатель для выбранного ДУ , вывод свойств
// document.getElementById("pbDiameter_edit").addEventListener("change", (event) => {
//     const selectedOption = event.target.selectedOptions[0];
//     const id = selectedOption.value;
//     const nomSize = selectedOption.textContent;    
// });
// Cлушатель для выбранного ДУ , вывод свойств
document.getElementById("get_tube_pipe").addEventListener("change", (event) => {
    get_load_pbDiameter(event.target.value, "pbDiameter");   
});
// Cлушатель для выбранного ДУ , вывод свойств
// document.getElementById("get_tube_pipe_sprinkler").addEventListener("change", (event) => {
//     get_load_pbDiameter(event.target.value, "pbDiameter_sprinkler");   
// });
// Cлушатель для выбранного ДУ , вывод свойств
document.getElementById("get_tube_pipe_edit").addEventListener("change", (event) => {
    get_load_pbDiameter(event.target.value, "pbDiameter_edit");   
});


async function get_sprinkler() {
    const sprinkler_select = document.getElementById('get_sprinkler');
    const sprinkler_list = await GetSprinkler();   
    console.log(sprinkler_select, sprinkler_list);


    sprinkler_list.forEach((sprinkler) => {
        const option = document.createElement("option");
        option.value = sprinkler.K;
        option.textContent = sprinkler.name;
        sprinkler_select.appendChild(option);
    });
    STATE.sprinkler_kv=sprinkler_select.value;
}

document.getElementById("get_sprinkler").addEventListener("change", (event) => {
    STATE.sprinkler_kv=event.target.value;
    console.log(STATE.sprinkler_kv);
    Engine.scene.traverse((node) => {
        if (node.name == 'Node_new' && node.type == 'Sprinkler') {
            node.K = STATE.sprinkler_kv;
        }
    });
});

get_sprinkler();

