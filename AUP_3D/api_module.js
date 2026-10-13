  async function get_type_tube() {
    fetch('/api/tubes/types/')
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        // console.log(response.json());
        return response.json();
    }
    ).catch(error => {
      console.error('Fetch error:', error)
    })
    
  }
async function get_tube(TubeTypeValue)
    {
      if(TubeTypeValue)
        {
            fetch(`/api/tubes/list/?type_id=${TubeTypeValue}`)
            .then(response => {
                    if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
                .catch(error => {
                    console.error('Ошибка сети:', error);
                });
        }
    }
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

  const data = await response.json(); // читаем ровно один раз
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