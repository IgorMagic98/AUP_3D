import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from django.http import JsonResponse
from django.shortcuts import redirect, render
from django.views.decorators.csrf import csrf_exempt
from General_eqution_new_3 import HydraulicSolver  # ← Импорт класса!

name = ['length', 'height', 'count', 'count_branch', 'DN']
name2 = ['velocity', 'pressure_loss', 'flow_region', 'pressure', 'flow_sprinkler']

@csrf_exempt
def sole_api(request):


    if request.method == 'POST':
        try:
            # Полные данные для солвера (как есть из формы)
            solver_data = dict(request.POST.lists())
            print("📥 Данные формы:", dict(list(solver_data.items())[:100]))
            
            # ✅ Создаем экземпляр солвера
            solver = HydraulicSolver(solver_data)
            # print('!!!!!solver_data:', solver_data)
            losses_out = solver.get_results_json()['losses_out']
            # sum=0
            number = [0,]
            print('losses_out',losses_out)
            # for k, v in losses_out.items():
            #     sum = sum + round(float(v),2)
            # # solver.print_global_dicts()
            # # ✅ Полный результат для фронтенд
            # sum = round(sum,2)
            # sum20 = round(sum * 0.2, 2)
            # print(solver.solution)
            # print('sum:', sum)

            # ТРЕБУЕМЫЕ ПАРАМЕТРЫ НАСОСА
            # solver.solution['calc_dickt']=solver_data['pressure_fixed']
            # solver.solution['calc_detail_z']=float(solver_data['a_1_height'][0])-float(solver_data['node_height'][0])
            # # solver.solution['calc_detail_pipe_losses']=sum
            # # solver.solution['calc_detail_local_losses']=sum20
            # # print('sum:', sum)
            # solver.solution['calc_detail_inlet']=float(solver_data['pump_inlet'][0])*100
            # print("TES")
            # solver.solution['calc_detail_total']=round(solver.solution['Pa1']+float(solver_data['a_1_height'][0])-float(solver_data['node_height'][0])+sum+sum20-float(solver_data['pump_inlet'][0])*100,2)
            # solver.solution['required_flow']=round(solver.solution['Quu12']*3.6,2)
            # solver.solution['required_pressure']=round(solver.solution['calc_detail_total'],2)



            count_value = int(solver_data['count_feed_pipe'][0])
            print(f"Расчет для питающего трубопровода №count_value: {count_value}")
            for j in range(1, count_value + 1):
                print(f"Расчет для питающего трубопровода 119 {j}")
                # print(f"Расчет для питающего трубопровода 120 {j+2}")
                # print(f"Расчет для питающего трубопровода 120 {j-1}")
                if solver_data.get(f'Type_feed_{j}') == ['line_feed']:     #Тупиковый трубопровод
                    # ЗАГЛУШКА ДЛЯ РАСЧЕТА ПОТЕРЬ НА УЗЛЕ
                    if 'dPuu12' not in solver.solution:
                        solver.solution['dPuu12'] = round(abs(solver.solution['Puu2']-solver.solution['Puu1']),2)
                    Vt = float(solver_data[f'feed_kt_{j}'][0])/float(solver_data[f'feed_length_{j}'][0])    
                    solver.solution[f'Qfeedpipe12_{j}']=round(solver.solution['Qfeedpipe12'],2)   #расход в трубе
                    solver.solution[f'Vfeedpipe12_{j}']=round(float(solver_data[f'feed_kvelocity_{j}'][0])*(solver.solution[f'Qfeedpipe12_{j}']),2)  #скорость в трубе
                    solver.solution[f'dPfeedpipe12_{j}']=round(float(solver.solution[f'Qfeedpipe12_{j}'])**2/Vt,2) #потери в трубе
                    if j-1 == 0:
                        solver.solution[f'Pfeedpipe2_{j}']=round(solver.solution['Pfeedpipe1']+solver.solution[f'dPfeedpipe12_{j}'],2)   #давление у питающего тупикового трубопроаодва
                    else:   
                        solver.solution[f'Pfeedpipe2_{j}']=round(solver.solution[f'Pfeedpipe2_{j-1}']+solver.solution[f'dPfeedpipe12_{j}'],2)   #давление у питающего тупикового трубопроаодва



                if solver_data.get(f'Type_feed_{j}') == ['annular_feed']:    #Кольцевой трубопровод
                    # ЗАГЛУШКА ДЛЯ РАСЧЕТА ПОТЕРЬ НА УЗЛЕ
                    if 'dPuu12' not in solver.solution:
                        solver.solution['dPuu12'] = round(abs(solver.solution['Puu2']-solver.solution['Puu1']),2)
                    Vt = float(solver_data[f'feed_kt_{j}'][0])/(float(solver_data[f'feed_length_{j}'][0])/2) # длину делим на 2, т.к. 1/2 кольца  В таблицу в исходных должна быт ьуказа полная длина кольца!!!!!!!!!!!!!!!!!!!
                    solver.solution[f'Qfeedpipe12_{j}']=round(solver.solution['Qfeedpipe12']/2,2)
                    solver.solution[f'Vfeedpipe12_{j}']=round(float(solver_data[f'feed_kvelocity_{j}'][0])*(solver.solution[f'Qfeedpipe12_{j}']),2)  #скорость в трубе
                    solver.solution[f'dPfeedpipe12_{j}']=round(float(solver.solution[f'Qfeedpipe12_{j}'])**2/Vt,2) #потери в трубе
                    if j-1 == 0:
                        solver.solution[f'Pfeedpipe2_{j}']=round(solver.solution['Pfeedpipe1']+solver.solution[f'dPfeedpipe12_{j}'],2)   #давление у питающего тупикового трубопроаодва
                    else:   
                        solver.solution[f'Pfeedpipe2_{j}']=round(solver.solution[f'Pfeedpipe2_{j-1}']+solver.solution[f'dPfeedpipe12_{j}'],2)   #давление у питающего тупикового трубопроаодва


                if j == count_value:
                    solver.solution['Puu2'] = round(solver.solution[f'Pfeedpipe2_{j}'] + solver.solution['dPuu12'],2)



            losses_all = {
                    k: v for k, v in solver.solution.items() 
                    if (k.startswith('dPa') or                    # ВСЯ ветка A (с индексами)
                re.match(r'^dP[a-z]{2}$', k) or
                k.startswith('dPfeed'))
            }
            print('Словрь losses_all 160',losses_all)
            total_losses = round(sum(losses_all.values()), 2)

            solver.solution['calc_dickt']=solver_data['pressure_fixed']
            solver.solution['calc_detail_z']=float(solver_data['a_1_height'][0])-float(solver_data['node_height'][0])

            solver.solution['calc_detail_pipe_losses']=round(total_losses - solver.solution['dPfeedpipe12'],2)
            solver.solution['calc_detail_local_losses']=round(solver.solution['calc_detail_pipe_losses']*0.2,2)

            solver.solution['calc_detail_inlet']=float(solver_data['pump_inlet'][0])*100

            solver.solution['calc_detail_total']=round((solver.solution['Pa1']+solver.solution['dPuu12']+float(solver_data['a_1_height'][0])-float(solver_data['node_height'][0])+solver.solution['calc_detail_pipe_losses']+solver.solution['calc_detail_local_losses']-float(solver_data['pump_inlet'][0])*100),2)
            solver.solution['required_flow']=round(solver.solution['Quu12']*3.6,2)
            solver.solution['required_pressure']=round(solver.solution['calc_detail_total'],2)
            status1 = float(solver.solution['Qa1'])==float(solver.solution['Qa12'])
            result = {
                'status1': status1, 
                'data': solver.solution,
                'result_pdf': {'solver_data': solver_data, 'solver_solution': solver.solution},
                'status': 'success',
                'solver': True,
                'equations': len(solver.global_equations),
                'variables': len(solver.global_unknowns),
                'solution_count': len(solver.solution),
                'results': solver.get_results_json(),
                'summary': {
                    'Pa1': round(solver.solution.get('Pa1', 0), 3),
                    'Q_total': round(solver.solution.get('Qfeedpipe12', 0), 3),
                    'Puu2': round(solver.solution.get('Puu2', 0), 3)
                }
            }
            print('result: ', result)
            print('Вход', solver_data)
            print('2 словаря', {'solver_data': solver_data, 'solver_solution': solver.solution})
            print('Выходные данные', solver.solution)
            print("🎉 API + СОЛЬВЕР РАБОТАЕТ!")
            calculate_result = CalculateResult.objects.create(
            None,
            data=solver_data)
            print(calculate_result)

            return JsonResponse(result)
            
        except Exception as e:
            print(f"❌ Ошибкаsdfsdfd: {e}")
            import traceback
            print(traceback.format_exc())
            return JsonResponse({
                'status': 'error',
                'message': str(e),
                'data_sample': dict(list(request.POST.lists())[:5])
            }, status=500)
    
    return JsonResponse({'error': 'POST only'}, status=405)

import json
@csrf_exempt
def new(request):
    if request.method == 'POST':
        body = json.loads(request.body.decode('utf-8'))
        print(body)
        return JsonResponse({
            'status': 'success',
            'received_data': body # Преобразуем QueryDict в обычный словарь для JSON
        })
