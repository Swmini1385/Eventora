from django.shortcuts import render, get_object_or_404
from django.http import HttpResponse
from .models import Event, Registration

def public_registration_view(request, event_id):
    # Depending on how the user creates events, they might not exist in the DB yet if the frontend didn't sync them.
    # For now, we assume the event exists. If it doesn't, we can gracefully show an error,
    # or create a dummy one for testing.
    
    try:
        event = Event.objects.get(id=event_id)
    except Event.DoesNotExist:
        # If the event doesn't exist in Django but exists in GAS, ideally we'd sync it.
        # For the sake of demonstration, we create a placeholder so the UI works.
        event = Event.objects.create(
            id=event_id,
            title=f"Event {event_id}",
            description="Join this amazing event!",
            date="2026-05-01",
            location="Online"
        )

    if request.method == 'POST':
        name = request.POST.get('name')
        phone = request.POST.get('phone')
        email = request.POST.get('email')
        
        if name and phone and email:
            Registration.objects.create(
                event=event,
                name=name,
                phone=phone,
                email=email
            )
            return render(request, 'registration/register.html', {'event': event, 'success': True})
        else:
            return render(request, 'registration/register.html', {'event': event, 'error': 'All fields are required.'})

    return render(request, 'registration/register.html', {'event': event})
