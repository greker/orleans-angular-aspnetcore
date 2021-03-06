import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Order, OrderCreateRequest, OrdersStats } from '../models/orders.model';
import { OrdersBackendService } from './orders-backend.service';
import { NotificationStoreService } from 'src/app/shared/services/notification-store.service';
import { handleHttpError } from 'src/app/shared/helpers/http/http-error.helpers';
import { NotificationLevel } from 'src/app/shared/models/notification.model';
import { delay } from 'src/app/shared/dialogs/delay.helper';
import { guid } from 'src/app/shared/types/guid.type';

@Injectable({
	providedIn: 'root'
})
export class OrdersStoreService implements OnDestroy {

	private _orders: BehaviorSubject<Order[]> = new BehaviorSubject([]);
	private _stats: BehaviorSubject<OrdersStats> = new BehaviorSubject({ all: 0, notDispatched: 0 });

	constructor(
		private backend: OrdersBackendService,
		private notification: NotificationStoreService,
	) { }

	ngOnDestroy() {
		// needed by untilDestroyed
	}

	get orders$() {
		return this._orders.asObservable();
	}

	get stats$() {
		return this._stats.asObservable();
	}

	getOrders() {
		const items = this.backend.getOrders();
		items.subscribe(result => {
			this._orders.next(result.orders);
		}, error => {
			handleHttpError(error, this.notification);
			this._orders.next([]);
		});
	}

	getOrderEvents(orderGuid: guid) {
		const items = this.backend.getOrderEvents(orderGuid);
		items.subscribe(result => {
			const orders = this._orders.getValue();
			const idx = orders.findIndex(x => x.id === orderGuid);
			orders[idx].events = result.events;
			this._orders.next(orders);
		}, error => {
			handleHttpError(error, this.notification);
			// this._events.next([]);
		});
	}

	async getStats(delayMilliseconds: number) {
		do {
			try {
				const result = await this.backend.getStats().toPromise();
				this._stats.next(result);
			} catch (e) {
				// ignore error, can be just a timeout (by design)
				console.error(e);
			}
			await delay(delayMilliseconds);
		} while (true);
	}

	async createOrder(request: OrderCreateRequest) {
		try {
			const response = await this.backend.createOrder(request);
			this.notification.dispatch(NotificationLevel.success, 'Order created');

			const orders = this._orders.getValue();
			orders.push(response);
			this._orders.next(orders);
			return true;
		} catch (error) {
			handleHttpError(error, this.notification);
		}
	}
}
