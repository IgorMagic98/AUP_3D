from django.db import models

class TubeType(models.Model):
    name = models.CharField(max_length=255, verbose_name="Тип трубы")

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Тип трубы"
        verbose_name_plural = "Тип труб"


class Type(models.Model):
    tube_type = models.ForeignKey(TubeType, on_delete=models.CASCADE, verbose_name="Тип трубы", related_name="types")
    nom_size = models.DecimalField(max_digits=10, decimal_places=1, verbose_name="Номинальный диаметр DN")
    ext_size = models.DecimalField(max_digits=10, decimal_places=1, verbose_name="Наружный диаметр, мм")
    thickness = models.DecimalField(max_digits=10, decimal_places=1, verbose_name="Толщина стенки, мм")
    k_t = models.DecimalField(max_digits=15, decimal_places=4, verbose_name="Удельная характеристика Kт, л²/с²")
    kvelocity = models.DecimalField(max_digits=15, decimal_places=4, verbose_name="Скоростной коэфицент")
    def __str__(self):
        return f"{self.tube_type.name} DN {self.nom_size}"

    class Meta:
        verbose_name = "Труба"
        verbose_name_plural = "Трубы"