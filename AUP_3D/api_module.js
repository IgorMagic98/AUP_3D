async function getTubeTypes() {
  const response = await fetch('/api/tubes/types/', {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP error! status: ${response.status}, body: ${text.substring(0, 500)}`);
  }

  const data = await response.json(); 
  // console.log("datataaa",data);// читаем ровно один раз
  return data;                        // это и есть «возвращаемые данные», но внутри Promise
}


async function getTube(TubeTypeValue) {
  const response = await fetch(`/api/tubes/list/?type_id=${TubeTypeValue}`, {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP error! status: ${response.status}, body: ${text.substring(0, 500)}`);
  }

  const data = await response.json(); // читаем ровно один раз
  return data;                        // это и есть «возвращаемые данные», но внутри Promise
}