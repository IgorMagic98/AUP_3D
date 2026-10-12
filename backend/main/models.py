from django.db import models

class SolverResult(models.Model):
    solver_solution = models.CharField(max_length=1000, verbose_name="Входные данные")
    solver_data = models.CharField(max_length=1000, verbose_name="Результаты расчета")
    solve_date = models.DateTimeField(
        'Дата расчета',
        auto_now_add=True
    )
    def __str__(self):
        return f'Расчет от {self.solve_date} идентификатор {self.id}'

    class Meta:
        verbose_name = "данные расчета"
        verbose_name_plural = "данные расчетов"