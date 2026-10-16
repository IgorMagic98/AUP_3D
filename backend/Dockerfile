FROM python:3.11

ENV PYTHONUNBUFFERED=1 

RUN mkdir -p /app 
WORKDIR /app

RUN pip install gunicorn

COPY requirements.txt .
RUN pip install -r requirements.txt 

COPY . .

CMD ["gunicorn", "main.wsgi:application", "--bind", "0.0.0.0:8000", "--timeout", "6000", "--reload"]