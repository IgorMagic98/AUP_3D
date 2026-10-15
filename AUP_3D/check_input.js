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
get_load_pipe("get_tube_pipe_sprinkler", "pbDiameter_sprinkler");
// функция заполнения ДУ для типа труб и сохранени ег освйоств
async function get_load_pbDiameter(TubeTypeValue, dn_tube) {
    const tube_DN = await getTube(TubeTypeValue);
    console.log("tube_DN массив данных",tube_DN);
    let pdDN = document.getElementById(dn_tube);
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
// Cлушатель для выбранного ДУ , вывод свойств
document.getElementById("pbDiameter").addEventListener("change", (event) => {
    const selectedOption = event.target.selectedOptions[0];
    const id = selectedOption.value;
    const nomSize = selectedOption.textContent;    
});
// Cлушатель для выбранного ДУ , вывод свойств
document.getElementById("pbDiameter_sprinkler").addEventListener("change", (event) => {
    const selectedOption = event.target.selectedOptions[0];
    const id = selectedOption.value;
    const nomSize = selectedOption.textContent;    
});
// Cлушатель для выбранного ДУ , вывод свойств
document.getElementById("get_tube_pipe").addEventListener("change", (event) => {
    get_load_pbDiameter(event.target.value, "pbDiameter");   
});
// Cлушатель для выбранного ДУ , вывод свойств
document.getElementById("get_tube_pipe_sprinkler").addEventListener("change", (event) => {
    get_load_pbDiameter(event.target.value, "pbDiameter_sprinkler");   
});