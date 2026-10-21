import logging
from decimal import Decimal
from typing import List

from django.contrib.postgres.fields import ArrayField
from django.db import models


class OTVTypes(models.TextChoices):
    water = "water", "Вода"
    foam = "foam", "Пена"


class ThermalLocks(models.TextChoices):
    sprinkler = "sprinkler", "Спринклерный"
    drench = "drench", "Дренчерный"


class MountingPositions(models.TextChoices):
    vertical_up = "vertical_up", "Вертикально вверх"
    vertical_down = "vertical_down", "Вертикально вниз"


class SprinklerQueryset(models.QuerySet):
    def find_by_irrigation_intensity(self, intensity: Decimal, otv_type) -> List[dict]:
        result = []
        for sprinkler in self.filter(
            Pmin__isnull=False,
            Pmax__isnull=False,
            otv_type=otv_type,
            intensity_Pmin__lte=intensity,
            intensity_Pmax__gte=intensity,
        ):
            if p_work := sprinkler.find_min_pressure_dependence_intensity(intensity=intensity):
                result_intensity = sprinkler.irrigation_intensity_dependence_pressure(p_work)
                data = {"sprinkler": sprinkler, "intensity": result_intensity, "p_work": p_work}
                result.append(data)
        return result

class Sprinkler(models.Model):
    otv_type = models.CharField("Тип ОТВ", max_length=50, choices=OTVTypes.choices, default=OTVTypes.water)
    thermal_lock = models.CharField(
        "Наличие теплового замка", max_length=100, blank=True, default=str, choices=ThermalLocks.choices
    )
    mounting_position = models.CharField(
        "Монтажное положение", max_length=100, blank=True, default=str, choices=MountingPositions.choices
    )
    name = models.CharField("Название", max_length=500)
    diameter = models.DecimalField(
        "Диаметр выходного отверстия d, мм", max_digits=5, decimal_places=2, null=True, blank=True
    )
    S = models.DecimalField("площадь орошения, м²", max_digits=5, decimal_places=1, null=True, blank=True)
    mu = models.DecimalField("Коэффициент расхода насадка μ", max_digits=5, decimal_places=3, null=True, blank=True)
    Pmin = models.DecimalField("Мин. рабочее давление, МПа", max_digits=5, decimal_places=3, null=True, blank=True)
    Pmax = models.DecimalField("Макс. рабочее давление, МПа", max_digits=5, decimal_places=3, null=True, blank=True)
    intensity_Pmin = models.DecimalField(
        "Интенсивность на мин. рабочем давлении",
        max_digits=8,
        decimal_places=5,
        null=True,
        blank=True,
        editable=False,
    )
    intensity_Pmax = models.DecimalField(
        "Интенсивность на макс. рабочем давлении",
        max_digits=8,
        decimal_places=5,
        null=True,
        blank=True,
        editable=False,
    )

    groups = ArrayField(
        verbose_name="Группы помещений", base_field=models.CharField(max_length=255), blank=True, null=True
    )

    k0 = models.DecimalField("коэффициент k0", default=0, max_digits=5, decimal_places=4, null=True, blank=True)
    k1 = models.DecimalField("коэффициент k1", default=0, max_digits=5, decimal_places=4, null=True, blank=True)
    k2 = models.DecimalField("коэффициент k2", default=0, max_digits=5, decimal_places=4, null=True, blank=True)
    k3 = models.DecimalField("коэффициент k3", default=0, max_digits=5, decimal_places=4, null=True, blank=True)
    k4 = models.DecimalField("коэффициент k4", default=0, max_digits=5, decimal_places=4, null=True, blank=True)
    k5 = models.DecimalField("коэффициент k5", default=0, max_digits=5, decimal_places=4, null=True, blank=True)
    k6 = models.DecimalField("коэффициент k6", default=0, max_digits=5, decimal_places=4, null=True, blank=True)#добавлена элемент
    k7 = models.DecimalField("коэффициент k7", default=0, max_digits=5, decimal_places=4, null=True, blank=True)#добавлена элемент
    K = models.DecimalField("Коэффициент производительности", max_digits=6, decimal_places=3, null=True, blank=True)


    objects = SprinklerQueryset().as_manager()

    class Meta:
        ordering = ("pk",)
        verbose_name = "Ороситель"
        verbose_name_plural = "Оросители"

    def __str__(self) -> str:
        parts = [self.name]
        if self.S:
            parts.append(f"(S={self.S} м²)")
        return " ".join(parts)

    def save(self, *args, **kwargs) -> None:
        super().save(*args, **kwargs)
        if self.Pmin:
            intensity_Pmin = self.irrigation_intensity_dependence_pressure(self.Pmin)
            if self.intensity_Pmin != intensity_Pmin:
                Sprinkler.objects.filter(pk=self.pk).update(intensity_Pmin=intensity_Pmin)
        if self.Pmax:
            intensity_Pmax = self.irrigation_intensity_dependence_pressure(self.Pmax)
            if self.intensity_Pmax != intensity_Pmax:
                Sprinkler.objects.filter(pk=self.pk).update(intensity_Pmax=intensity_Pmax)

    def get_str_diametr(self) -> str:
        return str(self.diameter)

    def get_str_mu(self) -> str:
        return str(self.mu)

    def irrigation_intensity_dependence_pressure(self, P: Decimal) -> Decimal:
        """
        расчет интенсивности орошения в зависимости от давления
        """
        intensity = 0
        description = ""
        k = [self.k0, self.k1, self.k2, self.k3, self.k4, self.k5, self.k6, self.k7]
        for i in range(8): #дОБАВИЛ
            intensity += P**i * k[i]
            description += f" + ({P}^{i} * {k[i]}) {i=}"
        return intensity.quantize(Decimal("1.0000"))

    def find_min_pressure_dependence_intensity(
        self, intensity: Decimal, step: Decimal = Decimal("0.001")
    ) -> Decimal | None:
        """
        находим нужное рабочее давление для заданной интенсивности
        """
        if not self.Pmin:
            return
        P = self.Pmin
        while True:
            if P > self.Pmax:
                return
            calculated_intensity = self.irrigation_intensity_dependence_pressure(P)
            if calculated_intensity >= intensity:
                return P
            P += step

    def get_graph_data(self, step: Decimal = Decimal(str("0.025"))) -> List[dict]:
        data = []
        if not self.Pmin:
            return
        P = Decimal(0)
        steps_count = (self.Pmax - self.Pmin) / step
        if steps_count > 50:
            step *= 2
        start_linear_p = Decimal("1.2")
        while True:
            if P < self.Pmin:
                data.append({"P": P.quantize(Decimal("1.000")), "intensity": None})
                P += step
                continue
            if P > self.Pmax:
                break
            if P > start_linear_p:
                # в конце участка рисуем прямую по двум точкам
                intensity_start = self.irrigation_intensity_dependence_pressure(start_linear_p)
                intensity_end = self.irrigation_intensity_dependence_pressure(self.Pmax)
                k = (intensity_end - intensity_start) / (self.Pmax - start_linear_p)
                b = intensity_start - k * start_linear_p
                intensity = k * P + b
            else:
                intensity = self.irrigation_intensity_dependence_pressure(P)
            data.append({"P": P.quantize(Decimal("1.000")), "intensity": intensity})
            P += step
        return data
